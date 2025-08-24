import { useEffect, useMemo, useState } from "react";
import { buildTgDeepLink, buildBrowserPreview } from "../lib/tg";

const API = import.meta.env.VITE_BACKEND_URL as string;
const BOT = (import.meta.env as any).VITE_BOT_USERNAME as string | undefined;

type SessionRow = {
  id: string;
  created_at: string;
  status: string;
  responses_count?: number;
  last_response_at?: string | null;
};

export default function FounderDashboard() {
  // force white page background
  useEffect(() => {
    document.body.style.background = "#ffffff";
    document.body.style.color = "#0f1115";
    return () => {};
  }, []);

  const [email, setEmail] = useState<string>("");
  const [signedIn, setSignedIn] = useState<boolean>(false);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hideDrafts, setHideDrafts] = useState(true);
  const [q, setQ] = useState("");
  const [copiedSid, setCopiedSid] = useState<string | null>(null);

  // bootstrap from localStorage or query param
  useEffect(() => {
    const fromStorage = localStorage.getItem("verityFounderEmail") || "";
    const fromQuery = new URLSearchParams(location.search).get("email") || "";
    const e = fromQuery || fromStorage;
    if (e) { setEmail(e); setSignedIn(true); }
  }, []);

  // load sessions
  useEffect(() => {
    if (!signedIn || !email) return;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/founder_sessions?founder_email=${encodeURIComponent(email)}`);
        const j = await r.json();
        const base: SessionRow[] = j?.sessions || [];
        setSessions(base);

        // Backfill counts if backend didn’t include them
        const needCounts = base.filter(s => typeof s.responses_count !== "number");
        if (needCounts.length) {
          const filled = await Promise.all(
            base.map(async (s) => {
              if (typeof s.responses_count === "number") return s;
              try {
                const sr = await fetch(`${API}/summary_sb?session_id=${encodeURIComponent(s.id)}`);
                const sj = await sr.json();
                return { ...s, responses_count: Number(sj?.responses_count ?? 0) };
              } catch {
                return { ...s, responses_count: 0 };
              }
            })
          );
          setSessions(filled);
        }
      } catch (e) {
        console.error(e);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [signedIn, email]);

  const shown = useMemo(
    () =>
      sessions.filter(
        (s) =>
          (!hideDrafts || s.status !== "draft") &&
          (!q || s.id.toLowerCase().includes(q.toLowerCase()))
      ),
    [sessions, hideDrafts, q]
  );

  const totalResponders = shown.reduce((sum, s) => sum + (s.responses_count ?? 0), 0);

  function fmt(ts?: string | null) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString(); } catch { return ts || "—"; }
  }

  // ✅ Always copy the web questionnaire link (not Telegram)
  async function copyLink(sid: string) {
    const link = `${location.origin}${buildBrowserPreview(sid)}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedSid(sid);
    setTimeout(() => setCopiedSid(null), 1200);
  }

  if (!signedIn) {
    return (
      <div className="container">
        <div className="card">
          <h1>Founder Dashboard</h1>
          <div className="sub">Sign in to see your questionnaires.</div>
          <div className="row" style={{ maxWidth: 440 }}>
            <label>Email</label>
            <input
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="btn_primary"
              onClick={() => {
                if (!email.includes("@")) { alert("Enter a valid email"); return; }
                localStorage.setItem("verityFounderEmail", email);
                setSignedIn(true);
              }}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h1>Founder Dashboard</h1>
            <div className="sub">Signed in as <code>{email}</code></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {BOT && <a className="btn_primary" href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer">TG Verity</a>}
            <button
              className="btn_secondary"
              onClick={() => {
                localStorage.removeItem("verityFounderEmail");
                setSignedIn(false);
                setSessions([]);
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt16" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="sub">
            Your sessions <strong>{shown.length}</strong> shown • <strong>{sessions.length}</strong> total
          </div>
          <div className="sub">Responders (shown): <strong>{totalResponders}</strong></div>
          <label className="field-inline" style={{ marginLeft: 10 }}>
            <input type="checkbox" checked={hideDrafts} onChange={(e)=>setHideDrafts(e.target.checked)} />
            Hide drafts
          </label>
          <div style={{ marginLeft: "auto", width: 260 }}>
            <input placeholder="Search session id…" value={q} onChange={(e)=>setQ(e.target.value)} />
          </div>
          <a className="btn_secondary" href="/founder/new">Create new interview</a>
        </div>

        <div className="mt16">
          {loading ? (
            <div className="sub">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="sub">No sessions to show.</div>
          ) : (
            <div className="table sessions">
              <div className="thead" style={{ fontWeight: 600, color: "var(--muted)" }}>
                <div>Session</div>
                <div>Created</div>
                <div>Status</div>
                <div>Responses</div>
                <div>Last response</div>
                <div>Actions</div>
              </div>

              {shown.map((s) => {
                const preview = buildBrowserPreview(s.id); // e.g. "/respond?sid=..."
                const deep = buildTgDeepLink(BOT, s.id);   // optional TG button
                const responders = s.responses_count ?? 0;

                return (
                  <div key={s.id} className="trow">
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.id}</div>
                    <div>{fmt(s.created_at)}</div>
                    <div><span className={`badge ${s.status === "active" ? "active" : "draft"}`}>{s.status || "—"}</span></div>
                    <div><span className="resp_badge">{responders}</span></div>
                    <div>{fmt(s.last_response_at)}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="pill_tag">Questionnaire</span>
                      <a className="btn_chip" href={preview} target="_blank" rel="noreferrer">Open</a>
                      <button
                        className={`btn_chip ${copiedSid === s.id ? "copied" : ""}`}
                        onClick={() => copyLink(s.id)}
                        title="Copy shareable link"
                      >
                        {copiedSid === s.id ? "Copied!" : "Share"}
                      </button>
                      {deep && <a className="btn_chip" href={deep} target="_blank" rel="noreferrer">TG Verity</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

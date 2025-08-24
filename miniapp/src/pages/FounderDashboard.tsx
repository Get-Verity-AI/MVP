import { useEffect, useState } from "react";
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
  // page background (not black)
  useEffect(() => {
    document.body.classList.add("dashboard-bg");
    return () => document.body.classList.remove("dashboard-bg");
  }, []);

  const [email, setEmail] = useState<string>("");
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hideDrafts, setHideDrafts] = useState(true);
  const [q, setQ] = useState("");
  const [copiedSid, setCopiedSid] = useState<string | null>(null);

  // bootstrap from localStorage
  useEffect(() => {
    const e = localStorage.getItem("verityFounderEmail") || "";
    if (e) { setEmail(e); setSignedIn(true); }
  }, []);

  useEffect(() => {
    if (!signedIn || !email) return;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/founder_sessions?founder_email=${encodeURIComponent(email)}`);
        const j = await r.json();
        setSessions(j?.sessions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [signedIn, email]);

  const shown = sessions.filter(s =>
    (!hideDrafts || s.status !== "draft") &&
    (!q || s.id.toLowerCase().includes(q.toLowerCase()))
  );

  function fmt(ts?: string | null) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString(); } catch { return ts || "—"; }
  }

  async function copyLink(sid: string) {
    const deep = buildTgDeepLink(BOT, sid);
    const link = deep || (location.origin + buildBrowserPreview(sid));
    await navigator.clipboard.writeText(link);
    setCopiedSid(sid);
    setTimeout(() => setCopiedSid(null), 1200);
  }

  if (!signedIn) {
    return (
      <div className="container">
        <div className="card dashboard">
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
      <div className="card dashboard">
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
                <div>Last response</div>
                <div>Actions</div>
                <div></div>
              </div>

              {shown.map((s) => {
                const preview = buildBrowserPreview(s.id);
                const deep = buildTgDeepLink(BOT, s.id);
                return (
                  <div key={s.id} className="trow">
                    <div>{s.id}</div>
                    <div>{fmt(s.created_at)}</div>
                    <div><span className={`badge ${s.status === "active" ? "active" : "draft"}`}>{s.status || "—"}</span></div>
                    <div>{fmt(s.last_response_at)}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="pill_tag">Questionnaire</span>
                      <a className="btn_chip" href={preview} target="_blank" rel="noreferrer">Open</a>
                      <button className={`btn_chip ${copiedSid === s.id ? "copied" : ""}`} onClick={() => copyLink(s.id)}>
                        {copiedSid === s.id ? "Copied!" : "Share"}
                      </button>
                      {deep && <a className="btn_chip" href={deep} target="_blank" rel="noreferrer">TG Verity</a>}
                    </div>
                    <div></div>
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

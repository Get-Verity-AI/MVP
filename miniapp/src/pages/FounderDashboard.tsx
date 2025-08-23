import { useEffect, useMemo, useState } from "react";
import { fetchFounderSessions } from "../lib/api";

function useQuery() {
  return useMemo(() => new URLSearchParams(location.search), []);
}

type SessionRow = {
  id: string;
  created_at: string;
  status: string | null;
  responses_count: number;
  last_response_at: string | null;
};

export default function FounderDashboard() {
  const q = useQuery();
  const [email, setEmail] = useState(q.get("email") || "");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // UI helpers
  const [hideDrafts, setHideDrafts] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    if (!email || !email.includes("@")) {
      setErr("Enter your founder email to load sessions.");
      setSessions([]);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchFounderSessions(email);
      setSessions(data.sessions || []);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (email) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = sessions.filter((s) => {
    if (hideDrafts && (s.status || "draft").toLowerCase() === "draft") return false;
    if (search.trim() && !s.id.includes(search.trim())) return false;
    return true;
  });

  const bot = import.meta.env.VITE_BOT_USERNAME as string | undefined;

  return (
    <div className="container">
      <h1 className="title">Founder Dashboard</h1>
      <p className="muted">See all your questionnaires and responses.</p>

      {/* Email loader */}
      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">Founder email</label>
        <div className="row">
          <input
            className="input"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
        {err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}
      </div>

      {/* Sessions table */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="card-title">
            Your sessions
            <span className="card-subtitle" style={{ marginLeft: 8 }}>
              {filtered.length} shown · {sessions.length} total
            </span>
          </div>

          <label className="row" style={{ gap: 8, alignItems: "center" }}>
            <span>Hide drafts</span>
            <input
              type="checkbox"
              checked={hideDrafts}
              onChange={(e) => setHideDrafts(e.target.checked)}
            />
          </label>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <input
            className="input"
            placeholder="Search session id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </div>

        {loading && <div className="muted" style={{ marginTop: 8 }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="muted" style={{ marginTop: 8 }}>
            No sessions match. Clear filters or create one in <code>/founder/new</code>.
          </div>
        )}

        <div className="table" style={{ marginTop: 12 }}>
          <div className="thead">
            <div>Session ID</div>
            <div>Created</div>
            <div>Status</div>
            <div>Responses</div>
            <div>Last response</div>
            <div>Links</div>
          </div>

          {filtered.map((s) => {
            const created = new Date(s.created_at).toLocaleString();
            const last = s.last_response_at ? new Date(s.last_response_at).toLocaleString() : "—";
            const sid = s.id;

            // Links
            const questionnaire = `/respond?sid=${sid}`; // public questionnaire link
            const viewResponses = `/founder/session?sid=${sid}`; // our responses page
            const deep = bot ? `https://t.me/${bot}?startapp=sid_${sid}` : null;

            return (
              <div className="trow" key={sid}>
                <div className="mono" style={{ wordBreak: "break-all" }}>{sid}</div>
                <div>{created}</div>

                <div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      color: (s.status || "draft") === "active" ? "#0b3" : "#999",
                      background: (s.status || "draft") === "active" ? "rgba(0,180,80,.1)" : "rgba(150,150,150,.12)",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    {s.status || "draft"}
                  </span>
                </div>

                <div>{s.responses_count}</div>
                <div>{last}</div>

                {/* LINKS column */}
                <div
                  className="links"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    alignItems: "flex-end",
                    minWidth: 190,
                  }}
                >
                  {/* Main questionnaire button */}
                  <a className="btn_primary" href={questionnaire} target="_blank">
                    Questionnaire
                  </a>

                  {/* Sub-row: Open + Share */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <a className="btn_secondary" href={questionnaire} target="_blank">
                      Open
                    </a>
                    <button
                      className="btn_secondary"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          new URL(questionnaire, location.origin).toString()
                        )
                      }
                    >
                      Share
                    </button>
                  </div>

                  {/* Telegram deep link */}
                  {deep && (
                    <a className="btn_secondary" href={deep} target="_blank">
                      TG Verity
                    </a>
                  )}

                  {/* View responses */}
                  <a className="btn_secondary" href={viewResponses} target="_blank">
                 View responses
                     </a>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

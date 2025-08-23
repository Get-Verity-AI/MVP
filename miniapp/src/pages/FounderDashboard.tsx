// miniapp/src/pages/FounderDashboard.tsx
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

  return (
    <div className="container">
      <h1 className="title">Founder Dashboard</h1>
      <p className="muted">See all your questionnaires and responses.</p>

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

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <div className="card-title">Your sessions</div>
          <div className="card-subtitle">{sessions.length} total</div>
        </div>

        {loading && <div className="muted">Loading…</div>}
        {!loading && sessions.length === 0 && (
          <div className="muted">No sessions yet. Create one in <code>/founder/new</code>.</div>
        )}

        <div className="table" style={{ marginTop: 8 }}>
          <div className="thead">
            <div>Session ID</div>
            <div>Created</div>
            <div>Status</div>
            <div>Responses</div>
            <div>Last response</div>
            <div>Links</div>
          </div>

          {sessions.map((s) => {
            const created = new Date(s.created_at).toLocaleString();
            const last = s.last_response_at
              ? new Date(s.last_response_at).toLocaleString()
              : "—";
            const sid = s.id;

            const preview = `/respond?sid=${sid}`;
            const bot = import.meta.env.VITE_BOT_USERNAME;
            const deep = bot ? `https://t.me/${bot}?startapp=sid_${sid}` : null;
            const viewResponses = `/founder/session?sid=${sid}`;

            return (
              <div className="trow" key={sid}>
                <div className="mono">{sid}</div>
                <div>{created}</div>
                <div>{s.status || "—"}</div>
                <div>{s.responses_count}</div>
                <div>{last}</div>
                <div className="row" style={{ gap: 8 }}>
                  <a className="link" href={preview} target="_blank">Preview</a>
                  {deep && (
                    <a className="link" href={deep} target="_blank">Telegram</a>
                  )}
                  <a className="link" href={viewResponses} target="_blank">
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

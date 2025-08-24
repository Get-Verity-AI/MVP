import { useEffect, useMemo, useState } from "react";
import { fetchSessionResponses } from "../lib/api";

function useQuery() {
  return useMemo(() => new URLSearchParams(location.search), []);
}

type RespRow = {
  id: string;
  created_at: string;
  answer_hash: string;
  tester_email?: string | null;
  tester_handle?: string | null; // optional, if backend starts returning it
  answers?: Record<string, unknown> | null;
  preview?: string; // optional, your api.ts type allows it
};

export default function FounderSession() {
  const q = useQuery();
  const sid = q.get("sid") || "";

  const [rows, setRows] = useState<RespRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({}); // expand/collapse

  async function load() {
    if (!sid) {
      setErr("Missing sid");
      setRows([]);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      // ask for answers so we can preview
      const data = await fetchSessionResponses(sid, { include_answers: true });
      // Be defensive: compute a preview if backend didn’t provide one
      const normalized = (data.responses || []).map((r) => ({
        ...r,
        preview:
          r.preview ??
          (() => {
            try {
              const s = JSON.stringify(r.answers ?? {}, null, 2);
              return s.length > 220 ? s.slice(0, 220) + "…" : s;
            } catch {
              return "";
            }
          })(),
      }));
      setRows(normalized);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load responses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  return (
    <div className="container">
      <h1 className="title">Session responses</h1>
      <p className="muted mono">Session ID: {sid || "—"}</p>

      <div className="card" style={{ marginTop: 12 }}>
        {err && <div className="error">{err}</div>}
        {loading && <div className="muted">Loading…</div>}
        {!loading && !err && rows.length === 0 && (
          <div className="muted">No responses yet.</div>
        )}

        {rows.length > 0 && (
          <>
            <div className="card-subtitle" style={{ marginBottom: 8 }}>
              {rows.length} response{rows.length === 1 ? "" : "s"}
            </div>

            <div className="table">
              <div className="thead">
                <div>Responder email</div>
                <div>Telegram</div>
                <div>Verified hash</div>
                <div>Submitted at</div>
                <div>Actions</div>
              </div>

              {rows.map((r) => {
                const dt = new Date(r.created_at).toLocaleString();
                const shortHash = r.answer_hash ? `${r.answer_hash.slice(0, 10)}…` : "—";
                const email = r.tester_email || "—";
                const tg = r.tester_handle || "—";
                const prettyAnswers =
                  (() => {
                    try {
                      return JSON.stringify(r.answers ?? {}, null, 2);
                    } catch {
                      return "";
                    }
                  })();

                return (
                  <div className="trow" key={r.id}>
                    <div className="mono">{email}</div>
                    <div>{tg}</div>
                    <div className="mono">{shortHash}</div>
                    <div>{dt}</div>

                    <div className="row" style={{ gap: 8 }}>
                      <button
                        className="btn_secondary"
                        onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                        title="Preview answers"
                      >
                        {open[r.id] ? "Hide answers" : "View answers"}
                      </button>

                      <a
                        className="btn_primary"
                        href={`data:application/json;charset=utf-8,${encodeURIComponent(
                          prettyAnswers
                        )}`}
                        download={`answers_${r.id}.json`}
                        title="Download full JSON"
                      >
                        Download JSON
                      </a>
                    </div>

                    {open[r.id] && (
                      <div className="card" style={{ marginTop: 8, gridColumn: "1 / -1" }}>
                        <div className="muted" style={{ marginBottom: 6 }}>
                          Preview
                        </div>
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                          {r.preview || prettyAnswers || "(empty)"}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

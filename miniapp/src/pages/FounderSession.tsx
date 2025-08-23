import { useEffect, useState } from "react";
import { fetchSessionResponses } from "../lib/api";

type Resp = {
  id: string;
  created_at: string;
  answer_hash: string;
  tester_email?: string | null;
  tester_handle?: string | null;
  preview: string;
  answers: Record<string, unknown> | null;
};

export default function FounderSession() {
  const params = new URLSearchParams(location.search);
  const sid = params.get("sid") || "";
  const tester = params.get("tester") || "";

  const [rows, setRows] = useState<Resp[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchSessionResponses(sid, {
          tester: tester || undefined,
          include_answers: true,
        });
        setRows(data.responses || []);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sid, tester]);

  if (!sid) return <div className="container"><div className="card">Missing sid</div></div>;
  if (err) return <div className="container"><div className="card" style={{color:"crimson"}}>Error: {err}</div></div>;
  if (loading) return <div className="container"><div className="card">Loading…</div></div>;

  return (
    <div className="container">
      <div className="card">
        <h1>Responses</h1>
        <div className="sub mt8">Session ID: <code>{sid}</code></div>

        <div className="mt16" style={{display:"flex", gap:8, alignItems:"center"}}>
          <form onSubmit={(e)=>{e.preventDefault();}}>
            <input
              placeholder="Filter by tester email"
              defaultValue={tester}
              onKeyDown={(e)=>{
                if (e.key === "Enter") {
                  const value = (e.target as HTMLInputElement).value.trim();
                  const url = new URL(location.href);
                  if (value) url.searchParams.set("tester", value);
                  else url.searchParams.delete("tester");
                  history.replaceState({}, "", url.toString());
                  location.reload();
                }
              }}
            />
          </form>
          {tester && (
            <button className="btn_secondary" onClick={()=>{
              const url = new URL(location.href);
              url.searchParams.delete("tester");
              history.replaceState({}, "", url.toString());
              location.reload();
            }}>Clear</button>
          )}
        </div>

        <div className="table mt16">
          <div className="trow trow_head">
            <div>Responder email</div>
            <div>Responder TG</div>
            <div>Verified hash</div>
            <div>Date</div>
            <div>Answers (preview)</div>
            <div>Actions</div>
          </div>

          {rows.map((r) => {
            const created = new Date(r.created_at).toLocaleString();
            const shortHash = r.answer_hash?.slice(0, 12) + "…";
            const onlyThis = r.tester_email
              ? `/founder/session?sid=${encodeURIComponent(sid)}&tester=${encodeURIComponent(r.tester_email)}`
              : undefined;
            const isOpen = openId === r.id;

            return (
              <div key={r.id} className="trow">
                <div>{r.tester_email || "—"}</div>
                <div>{r.tester_handle || "—"}</div>
                <div className="mono" title={r.answer_hash}>
                  {shortHash}
                </div>
                <div className="mono">{created}</div>

                <div>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setOpenId(isOpen ? null : r.id); }}
                    title="Click to view full answers"
                  >
                    {r.preview || "—"}
                  </a>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  {onlyThis && <a className="link" href={onlyThis}>Only this tester</a>}
                  <button
                    className="btn_secondary"
                    onClick={() => navigator.clipboard.writeText(r.answer_hash)}
                    title="Copy hash"
                  >
                    Copy hash
                  </button>
                </div>

                {isOpen && (
                  <div className="mt8" style={{ gridColumn: "1 / -1" }}>
                    <pre style={{ overflowX:"auto" }}>{JSON.stringify(r.answers, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="trow">
              <div style={{ gridColumn: "1 / -1" }}>No responses{tester ? ` for ${tester}` : ""}.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

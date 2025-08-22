import { useState } from "react";
import axios from "axios";

const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function New() {
  const [idea_summary, setIdea] = useState("");
  const [target_user, setUser] = useState("");
  const [problems, setProblems] = useState(""); // comma separated
  const [value_prop, setVP] = useState("");
  const [target_action, setTA] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true); setLink(null);
    try {
      const body = {
        founder_inputs: {
          idea_summary,
          target_user,
          problems: problems.split(",").map(s => s.trim()).filter(Boolean),
          value_prop,
          target_action
        }
      };
      const { data } = await axios.post(`${BASE}/session`, body, {
        headers: { "content-type": "application/json" }
      });
      const sid: string = data.session_id;
      const url = `${location.origin}/?session_id=${sid}`;
      setLink(url);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{maxWidth:720, margin:"0 auto", padding:16}}>
      <h1 style={{fontSize:22, fontWeight:700, marginBottom:8}}>Create Interview Link</h1>
      <p style={{color:"#555", marginBottom:16}}>
        Fill this once, share the generated link with respondents.
      </p>

      <form onSubmit={onSubmit} style={{display:"grid", gap:12}}>
        <input placeholder="Idea summary" value={idea_summary} onChange={e=>setIdea(e.target.value)} required />
        <input placeholder="Target user" value={target_user} onChange={e=>setUser(e.target.value)} required />
        <input placeholder="Problems (comma-separated)" value={problems} onChange={e=>setProblems(e.target.value)} required />
        <input placeholder="Value prop" value={value_prop} onChange={e=>setVP(e.target.value)} />
        <input placeholder="Target action (e.g., sign up)" value={target_action} onChange={e=>setTA(e.target.value)} />
        <button disabled={loading} style={{padding:"10px 16px"}}>{loading ? "Creating…" : "Create session"}</button>
      </form>

      {err && <div style={{marginTop:12, color:"red"}}>Error: {err}</div>}
      {link && (
        <div style={{marginTop:12}}>
          <div>Share this link:</div>
          <code>{link}</code>
        </div>
      )}
    </div>
  );
}

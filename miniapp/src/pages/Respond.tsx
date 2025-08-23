import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Step } from "../types";

export default function Respond() {
  const params = new URLSearchParams(location.search);
  const sid = params.get("sid") || "";
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/session_questions`, { params: { session_id: sid } });
        setSteps(data.steps || []);
      } catch (e:any) {
        setErr(e?.response?.data?.detail || e.message);
      }
    })();
  }, [sid]);

  const step:any = steps[i];
  function setAnswer(k:string, v:any){ setAnswers(p=>({...p,[k]:v})); }
  function next(){
    if (!step) return;
    if (step.type !== "text"){
      const v = answers[step.key];
      if (v === undefined || v === "") { setErr("Please answer to continue"); return; }
    }
    setErr(null); setI(i+1);
  }

  async function submit(){
    setSubmitting(true);
    try{
      const email = answers["email"] && String(answers["email"]).includes("@")
        ? String(answers["email"]) : undefined;
      await api.post("/responses_sb", { session_id: sid, tester_email: email, answers });
      setDone(true);
    }catch(e:any){
      setErr(e?.response?.data?.detail || e.message);
    }finally{ setSubmitting(false); }
  }

  if (!sid) return <div className="container"><div className="card">Missing sid</div></div>;
  if (err)  return <div className="container"><div className="card" style={{color:"crimson"}}>Error: {err}</div></div>;
  if (done) return (
    <div className="container">
      <div className="card"><h2>Thanks! 🎉</h2><p className="sub">Your answers have been recorded.</p></div>
    </div>
  );
  if (!step) return <div className="container"><div className="card">Loading…</div></div>;

  return (
    <div className="container">
      <div className="card">
        <div className="sub"><span className="pill">Step {Math.min(i+1, steps.length)} of {steps.length}</span></div>
        {"label" in step && <h2 className="mt12">{step.label}</h2>}

        {step.type === "text"      && <div className="mt12 help" style={{whiteSpace:"pre-wrap"}}>Tap next to continue.</div>}
        {step.type === "input_text" && (
          <textarea className="mt12" rows={5}
            value={answers[step.key] || ""}
            onChange={e => setAnswer(step.key, e.target.value)}
          />
        )}
        {step.type === "input_scale" && (
          <input className="mt12" type="number" min={step.min} max={step.max}
            value={answers[step.key] ?? ""}
            onChange={e => { const n = Number(e.target.value); if (!Number.isNaN(n)) setAnswer(step.key, n); }}
          />
        )}
        {step.type === "input_email" && (
          <input className="mt12" type="email"
            value={answers[step.key] || ""}
            onChange={e => setAnswer(step.key, e.target.value)}
          />
        )}

        <div className="actions mt16">
          {i < steps.length-1
            ? <button className="btn primary" onClick={next}>Next</button>
            : <button className="btn primary" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

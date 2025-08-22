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
      } catch (e: any) {
        setErr(e?.response?.data?.detail || e.message);
      }
    })();
  }, [sid]);

  const step: any = steps[i];

  function setAnswer(key: string, val: any) {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }

  function next() {
    if (!step) return;
    if ("key" in step && step.type !== "text") {
      const v = answers[step.key];
      if (v === undefined || v === "") {
        setErr("Please answer to continue");
        return;
      }
    }
    setErr(null);
    setI(i + 1);
  }

  async function submit() {
    setSubmitting(true);
    try {
      const email =
        answers["email"] && String(answers["email"]).includes("@")
          ? String(answers["email"])
          : undefined;
      await api.post("/responses_sb", { session_id: sid, tester_email: email, answers });
      setDone(true);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!sid) return <div style={{ padding: 16 }}>Missing sid</div>;
  if (err) return <div style={{ padding: 16, color: "red" }}>Error: {err}</div>;
  if (done) return <div style={{ padding: 16 }}><h2>Thanks! 🎉</h2><p>Your answers have been recorded.</p></div>;
  if (!step) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ color: "#666" }}>Step {Math.min(i + 1, steps.length)} of {steps.length}</div>
      {"label" in step && <h2 style={{ margin: "8px 0" }}>{step.label}</h2>}

      {step.type === "text" && <div style={{ whiteSpace: "pre-wrap" }} />}

      {step.type === "input_text" && (
        <textarea
          rows={4}
          value={answers[step.key] || ""}
          onChange={(e) => setAnswer(step.key, e.target.value)}
        />
      )}

      {step.type === "input_scale" && (
        <input
          type="number"
          min={step.min}
          max={step.max}
          value={answers[step.key] ?? ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) setAnswer(step.key, n);
          }}
        />
      )}

      {step.type === "input_email" && (
        <input
          type="email"
          value={answers[step.key] || ""}
          onChange={(e) => setAnswer(step.key, e.target.value)}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {i < steps.length - 1 ? (
          <button onClick={next}>Next</button>
        ) : (
          <button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { fetchScript, postResponse } from "./lib/api";
import type { Step } from "./lib/api";


function useQuery() {
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

export default function App() {
  const q = useQuery();
  const sessionId = q.get("session_id") || "";
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<null | { session_id: string; steps: Step[] }>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respondentId = useMemo(() => `web-${Math.random().toString(36).slice(2, 10)}`, []);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session_id. Ask the founder for a valid link.");
      return;
    }
    setLoading(true);
    fetchScript(sessionId)
      .then((s) => {
        setScript(s);
        setCurrentId(s.steps[0]?.id ?? null);
      })
      .catch((e) => setError(e?.response?.data?.detail || "Failed to load script"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!script) return <div className="p-6">No script loaded.</div>;
  if (done) return <ThankYou />;

  const step = script.steps.find((s) => s.id === currentId) || null;

  async function onSubmit(value: unknown) {
    if (!step) return;
    const updated = { ...answers, [step.id]: value };
    setAnswers(updated);

    try {
      await postResponse({
        session_id: script.session_id,
        respondent_id: respondentId,
        answers: { [step.id]: value },
        meta: { client: "miniapp", ts: new Date().toISOString() },
      });
    } catch (e) {
      console.error("postResponse failed", e);
    }

    const nextId = step.next ?? null;
    if (!nextId) setDone(true);
    else setCurrentId(nextId);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <Header />
      {step ? <StepView step={step} onSubmit={onSubmit} /> : <div>All steps complete.</div>}
    </div>
  );
}

function Header() {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold">Verity Interview</h1>
      <p className="text-sm text-gray-600">Honest insights → better product decisions.</p>
    </div>
  );
}

function StepView({ step, onSubmit }: { step: Step; onSubmit: (v: unknown) => void }) {
  if (step.type === "text") {
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line">{step.prompt}</p>
        <button className="rounded px-4 py-2 bg-black text-white" onClick={() => onSubmit(true)}>
          Continue
        </button>
      </div>
    );
  }
  if (step.type === "input_text") {
    const [value, setValue] = useState("");
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line">{step.prompt}</p>
        <textarea
          className="w-full border rounded p-2"
          rows={5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="rounded px-4 py-2 bg-black text-white" onClick={() => onSubmit(value)}>
          Submit
        </button>
      </div>
    );
  }
  if (step.type === "input_scale") {
    const [value, setValue] = useState<number>(3);
    const min = step.min ?? 1,
      max = step.max ?? 5;
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line">{step.prompt}</p>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <div>Selected: {value}</div>
        <button className="rounded px-4 py-2 bg-black text-white" onClick={() => onSubmit(value)}>
          Submit
        </button>
      </div>
    );
  }
  if (step.type === "input_email") {
    const [value, setValue] = useState("");
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line">{step.prompt}</p>
        <input
          className="w-full border rounded p-2"
          placeholder="you@example.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="rounded px-4 py-2 bg-black text-white" onClick={() => onSubmit(value)}>
          Submit
        </button>
      </div>
    );
  }
  return <div>Unsupported step: {step.type}</div>;
}

function ThankYou() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Thanks for sharing 🙏</h2>
      <p className="text-gray-700">
        Your answers help founders navigate to PMF with real, unbiased insight.
      </p>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { FounderInputsStreamlit } from "../types";

const empty: FounderInputsStreamlit = {
  email: "",
  problem_domain: "",
  problems: [],
  value_prop: "",
  target_action: "",
  follow_up_action: "",
  is_paid_service: false,
  pricing_model: "",
  price_points: [],
  pricing_questions: [],
  target_audience: "",
};

export default function FounderNew() {
  const [v, setV] = useState<FounderInputsStreamlit>(empty);
  const [i, setI] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sid, setSid] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);

  useEffect(() => {}, []);

  const steps = useMemo(
    () => [
      { key: "email", label: "Your email (for session owner)", required: true },
      { key: "problem_domain", label: "Industry / problem domain", required: false },
      { key: "problems", label: "List 1–3 problems (comma separated)", required: true },
      { key: "value_prop", label: "Value proposition (what makes it compelling?)", required: false },
      { key: "target_action", label: "What action do you want users to take?", required: true },
      { key: "follow_up_action", label: "Next step after initial action (optional)", required: false },
      { key: "target_audience", label: "Target audience (who is this for?)", required: false },
      { key: "is_paid_service", label: "Is this a paid service?", type: "checkbox", required: false },
      {
        key: "pricing_model",
        label: "Pricing model",
        type: "select",
        options: ["Subscription", "One-time", "Freemium", "Usage-based", "Other"],
        when: (v: FounderInputsStreamlit) => v.is_paid_service,
      },
      {
        key: "price_points",
        label: "Price points (comma separated numbers)",
        when: (v: FounderInputsStreamlit) => v.is_paid_service,
      },
      {
        key: "pricing_questions",
        label: "Pricing questions (comma separated)",
        when: (v: FounderInputsStreamlit) => v.is_paid_service,
      },
    ],
    []
  );

  const visible = steps.filter((s: any) => !s.when || s.when(v));
  const step: any = visible[i];

  function setField(k: keyof FounderInputsStreamlit, val: any) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  function next() {
    if (step?.required) {
      const val = (v as any)[step.key];
      const valid =
        typeof val === "boolean"
          ? true
          : !!(val && (typeof val !== "string" || val.trim() !== ""));
      if (!valid) {
        setErr("This field is required");
        return;
      }
    }
    setErr(null);
    setI(i + 1);
  }

  function prev() {
    setErr(null);
    setI(Math.max(0, i - 1));
  }

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        ...v,
        problems: Array.isArray(v.problems)
          ? v.problems
          : String(v.problems || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
        price_points: Array.isArray(v.price_points)
          ? v.price_points
          : String(v.price_points || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map(Number),
        pricing_questions: Array.isArray(v.pricing_questions)
          ? v.pricing_questions
          : String(v.pricing_questions || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
      };
      const { data } = await api.post("/session_sb", payload);
      setSid(data.session_id);
      setShare(data.share_link);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  }

  if (sid) {
    const bot = import.meta.env.VITE_BOT_USERNAME;
    const deep = bot ? `https://t.me/${bot}?startapp=sid_${sid}` : null;

    return (
      <div className="container">
        <div className="card">
          <h1>Questionnaire ready ✅</h1>
          <div className="sub mt8">Session ID: <code>{sid}</code></div>
          <div className="actions mt16">
            {share && (
              <>
                <button
                  className="btn_secondary"
                  onClick={() => navigator.clipboard.writeText(share!)}
                >
                  Copy Share Link
                </button>
                <a className="btn_primary" href={share} target="_blank">
                  Open Share Link
                </a>
                {deep && (
                  <a className="btn_secondary" href={deep} target="_blank">
                    Open Telegram Deep Link
                  </a>
                )}
                <a
                  className="btn_secondary"
                  href={`/respond?sid=${sid}`}
                  target="_blank"
                >
                  Preview Questionnaire (browser)
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Founder Questionnaire</h1>
        <div className="sub mt8">
          Step {i + 1} of {visible.length}
        </div>

        {step && (
          <div className="form mt16">
            <div className="row">
              {step.type !== "checkbox" && <label>{step.label}</label>}
              {step.type === "checkbox" ? (
                <div className="field-inline">
                  <input
                    id={`cb-${step.key}`}
                    type="checkbox"
                    checked={Boolean((v as any)[step.key])}
                    onChange={(e) =>
                      setField(step.key as any, e.target.checked)
                    }
                  />
                  <label htmlFor={`cb-${step.key}`}>{step.label}</label>
                </div>
              ) : step.type === "select" ? (
                <select
                  value={(v as any)[step.key] || ""}
                  onChange={(e) =>
                    setField(step.key as any, e.target.value || undefined)
                  }
                >
                  <option value="">Select…</option>
                  {step.options?.map((op: string) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={(v as any)[step.key] || ""}
                  onChange={(e) => setField(step.key as any, e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        {err && (
          <div style={{ color: "red", marginTop: 8 }}>
            Error: {err}{" "}
            <button onClick={() => setErr(null)}>Reset</button>
          </div>
        )}

        <div className="actions mt16">
          <button onClick={prev} disabled={i === 0}>
            Back
          </button>
          {i < visible.length - 1 ? (
            <button onClick={next}>Next</button>
          ) : (
            <button disabled={saving} onClick={submit}>
              {saving ? "Creating…" : "Create Session"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

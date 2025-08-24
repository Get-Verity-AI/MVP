// miniapp/src/pages/Respond.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Step } from "../types";
import { connectWallet, disconnectWallet } from "../lib/nearWallet";
import { getStartSid } from "../lib/tg";

type AnyAnswers = Record<string, any>;

export default function Respond() {
  // Allow sid from URL or Telegram Mini App start_param
  const sid = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("sid") || getStartSid() || "";
  }, []);

  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<AnyAnswers>({});
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!sid) return;
      try {
        const { data } = await api.get(`/session_questions`, {
          params: { session_id: sid },
        });
        setSteps((data.steps || []) as Step[]);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || e.message || "Failed to load questions");
      }
    })();
  }, [sid]);

  const step: any = steps[i];

  function setAnswer(k: string, v: any) {
    setAnswers((p) => ({ ...p, [k]: v }));
  }

  function next() {
    if (!step) return;

    // Wallet step is OPTIONAL — allow continuing even if empty
    const optionalTypes = new Set(["text", "input_wallet"]);

    if (!optionalTypes.has(step.type)) {
      const v = answers[step.key];
      if (v === undefined || v === "") {
        setErr("Please answer to continue");
        return;
      }
    }

    setErr(null);
    setI((x) => x + 1);
  }

  async function submit() {
    setSubmitting(true);
    try {
      const email =
        answers["email"] && String(answers["email"]).includes("@")
          ? String(answers["email"])
          : undefined;

      await api.post("/responses_sb", {
        session_id: sid,
        tester_email: email,
        answers,
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onConnectWallet(fieldKey: string) {
    try {
      const res = await connectWallet();
      if (typeof res === "string") {
        setAnswer(fieldKey, res);
      } else if (res && typeof res === "object") {
        if (res.account) setAnswer(fieldKey, res.account);
        if (res.type) setAnswer(`${fieldKey}_provider`, res.type);
      }
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Wallet connection failed");
      setTimeout(() => setErr(null), 2000);
    }
  }

  async function onDisconnectWallet(fieldKey: string) {
    try {
      await disconnectWallet();
    } catch {}
    setAnswer(fieldKey, "");
  }

  if (!sid)
    return (
      <div className="container">
        <div className="card">Missing sid</div>
      </div>
    );
  if (err)
    return (
      <div className="container">
        <div className="card" style={{ color: "crimson" }}>
          Error: {err}
        </div>
      </div>
    );
  if (done)
    return (
      <div className="container">
        <div className="card">
          <h2>Thanks! 🎉</h2>
          <p className="sub">Your answers have been recorded.</p>
        </div>
      </div>
    );
  if (!step)
    return (
      <div className="container">
        <div className="card">Loading…</div>
      </div>
    );

  return (
    <div className="container">
      <div className="card">
        <div className="sub">
          <span className="pill">
            Step {Math.min(i + 1, steps.length)} of {steps.length}
          </span>
        </div>

        {"label" in step && (
          <h2 className="mt12" style={{ whiteSpace: "pre-wrap" }}>
            {step.label}
          </h2>
        )}

        {/* READ-ONLY */}
        {step.type === "text" && (
          <div className="mt12 help" style={{ whiteSpace: "pre-wrap" }}>
            Tap next to continue.
          </div>
        )}

        {/* LONG TEXT */}
        {step.type === "input_text" && (
          <textarea
            className="mt12"
            rows={5}
            value={answers[step.key] || ""}
            onChange={(e) => setAnswer(step.key, e.target.value)}
          />
        )}

        {/* SCALE */}
        {step.type === "input_scale" && (
          <input
            className="mt12"
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

        {/* EMAIL */}
        {step.type === "input_email" && (
          <input
            className="mt12"
            type="email"
            value={answers[step.key] || ""}
            onChange={(e) => setAnswer(step.key, e.target.value)}
          />
        )}

        {/* CHOICE */}
        {step.type === "input_choice" && Array.isArray(step.options) && (
          <div className="mt12" style={{ display: "grid", gap: 8 }}>
            {step.options.map((opt: string, idx: number) => {
              const id = `opt_${step.key}_${idx}`;
              return (
                <label key={id} htmlFor={id} className="v-choice" style={{ cursor: "pointer" }}>
                  <input
                    id={id}
                    name={step.key}
                    type="radio"
                    checked={answers[step.key] === opt}
                    onChange={() => setAnswer(step.key, opt)}
                  />
                  <span style={{ marginLeft: 8 }}>{opt}</span>
                </label>
              );
            })}
          </div>
        )}

        {/* WALLET (OPTIONAL) */}
        {step.type === "input_wallet" && (
          <div className="mt12" style={{ display: "grid", gap: 8 }}>
            {answers[step.key] ? (
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <span className="pill">Connected: {String(answers[step.key])}</span>
                <button
                  className="btn_secondary"
                  onClick={() => onDisconnectWallet(step.key)}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn_primary"
                  onClick={() => onConnectWallet(step.key)}
                >
                  Connect Wallet
                </button>
                <button
                  className="btn_secondary"
                  onClick={() => {
                    setErr(null);
                    setI((x) => x + 1);
                  }}
                  title="You can connect later"
                >
                  Skip for now
                </button>
              </div>
            )}
            <div className="sub mt8">
              Optional: connecting helps verify your responses later.
            </div>
          </div>
        )}

        <div className="actions mt16">
          {i < steps.length - 1 ? (
            <button className="btn primary" onClick={next}>
              Next
            </button>
          ) : (
            <button className="btn primary" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


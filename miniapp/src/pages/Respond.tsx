// miniapp/src/pages/Respond.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Step } from "../types";
import { connectWallet, disconnectWallet } from "../lib/nearWallet";
import { getStartSid } from "../lib/tg";
import { supabase } from "../lib/supabase";

type AnyAnswers = Record<string, any>;

export default function Respond() {
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      // Check authentication status
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session?.user);
      } else {
        // Fallback to localStorage check
        const testerEmail = localStorage.getItem("verityTesterEmail");
        setIsAuthenticated(!!testerEmail);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!sid) return;
      try {
        const { data } = await api.get(`/session_questions`, { params: { session_id: sid } });
        let stepsData = (data.steps || []) as Step[];
        
        // Skip account_setup step if user is authenticated
        if (isAuthenticated) {
          stepsData = stepsData.filter(step => step.type !== "account_setup");
        }
        
        setSteps(stepsData);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || e.message || "Failed to load questions");
      }
    })();
  }, [sid, isAuthenticated]);

  const step: any = steps[i];
  const setAnswer = (k: string, v: any) => setAnswers((p) => ({ ...p, [k]: v }));
  const back = () => { setErr(null); setI((x) => Math.max(0, x - 1)); };
  function requiredForStep(): string | null {
    if (!step) return null;

    // steps that never require input
    const optional = new Set(["text", "input_wallet", "account_setup"]);
    if (optional.has(step.type)) return null;

    // Make email step optional
    if (step.type === "input_email") {
      return null; // Email is always optional
    }

    if (step.type === "problem_block") {
      const scoreKey = `${step.key}_score`;
      const v = answers[scoreKey];
      if (v === undefined || v === "") return "Please provide a 1–5 score.";
      return null;
    }

    if (step.type === "input_text") {
      const k = step.key;
      const v = k ? answers[k] : "";
      if (!v || String(v).trim() === "") return "Please answer to continue";
      return null;
    }

    if (step.type === "input_scale") {
      const v = answers[step.key];
      if (v === undefined || v === "") return "Please provide a score.";
      const n = Number(v);
      if (Number.isNaN(n)) return "Please enter a number.";
      if (typeof step.min === "number" && n < step.min) return `Minimum is ${step.min}.`;
      if (typeof step.max === "number" && n > step.max) return `Maximum is ${step.max}.`;
      return null;
    }

    if (step.type === "input_choice") {
      const v = answers[step.key];
      if (v === undefined || v === "") return "Please select an option.";
      return null;
    }

    if (step.type === "scale_with_preamble") {
      const v = answers[step.key];
      if (v === undefined || v === "") return "Please provide a 1–5 score.";
      const n = Number(v);
      if (Number.isNaN(n)) return "Please enter a number.";
      if (typeof step.min === "number" && n < step.min) return `Minimum is ${step.min}.`;
      if (typeof step.max === "number" && n > step.max) return `Maximum is ${step.max}.`;
      return null;
    }

    // generic fallback for any other question types
    const v = answers[step.key];
    if (v === undefined || v === "" || (typeof v === "string" && v.trim() === "")) {
      return "Please answer to continue";
    }
    return null;
  }
  
  function next() {
    if (!step) return;
    const need = requiredForStep();
    if (need) { setErr(need); return; }
    setErr(null); setI((x) => x + 1);
  }

  async function submit() {
    const need = requiredForStep();
    if (need) { setErr(need); return; }
    setSubmitting(true);
    try {
      // Get email from answers or authenticated user
      let email = undefined;
      
      // First check if user provided email in the questionnaire
      if (answers["email"] && String(answers["email"]).includes("@")) {
        email = String(answers["email"]);
      }
      // If no email in answers, check if user is authenticated
      else if (isAuthenticated) {
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) {
            email = session.user.email;
          }
        } else {
          // Fallback to localStorage
          const testerEmail = localStorage.getItem("verityTesterEmail");
          if (testerEmail && testerEmail.includes("@")) {
            email = testerEmail;
          }
        }
      }
      
      await api.post("/responses_sb", { session_id: sid, tester_email: email, answers });
      setDone(true);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Submit failed");
    } finally { setSubmitting(false); }
  }

  async function onConnectWallet(fieldKey: string) {
    try {
      const res = await connectWallet();
      if (typeof res === "string") setAnswer(fieldKey, res);
      else if (res && typeof res === "object") {
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
    try { await disconnectWallet(); } catch {}
    setAnswer(fieldKey, "");
  }

  if (!sid) return <div className="container"><div className="card">Missing sid</div></div>;
  if (done) return <div className="container"><div className="card"><h2>Thanks! 🎉</h2><p className="sub">Your answers have been recorded.</p></div></div>;
  if (!step) return <div className="container"><div className="card">Loading…</div></div>;

  const scoreKey = step?.type === "problem_block" ? `${step.key}_score` : null;
  const reasonKey = step?.type === "problem_block" ? `${step.key}_reason` : null;
  const attemptsKey = step?.type === "problem_block" ? `${step.key}_attempts` : null;

  return (
    <div className="container">
      <div className="card">
        <div className="sub"><span className="pill">Step {Math.min(i + 1, steps.length)} of {steps.length}</span></div>

        {"label" in step && step.label && (
          <h2 className="mt12" style={{ whiteSpace: "pre-wrap" }}>{step.label}</h2>
        )}

        {step.type === "text" && (
          <div className="mt12 help" style={{ whiteSpace: "pre-wrap" }}>Tap next to continue.</div>
        )}

        {step.type === "input_text" && (
          <textarea className="mt12" rows={5}
            value={answers[step.key] || ""}
            onChange={(e) => setAnswer(step.key, e.target.value)}
          />
        )}

        {step.type === "input_scale" && (
          <input className="mt12" type="number" min={step.min} max={step.max}
            value={answers[step.key] ?? ""}
            onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setAnswer(step.key, n); }}
          />
        )}

        {step.type === "input_email" && (
          <input className="mt12" type="email"
            value={answers[step.key] || ""}
            onChange={(e) => setAnswer(step.key, e.target.value)}
          />
        )}

        {step.type === "input_choice" && Array.isArray(step.options) && (
          <div className="mt12" style={{ display: "grid", gap: 8 }}>
            {step.options.map((opt: string, idx: number) => {
              const id = `opt_${step.key}_${idx}`;
              return (
                <label key={id} htmlFor={id} className="v-choice" style={{ cursor: "pointer" }}>
                  <input id={id} name={step.key} type="radio"
                    checked={answers[step.key] === opt}
                    onChange={() => setAnswer(step.key, opt)}
                  />
                  <span style={{ marginLeft: 8 }}>{opt}</span>
                </label>
              );
            })}
          </div>
        )}

        {step.type === "input_wallet" && (
          <div className="mt12" style={{ display: "grid", gap: 8 }}>
            {answers[step.key] ? (
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <span className="pill">Connected: {String(answers[step.key])}</span>
                <button className="btn_secondary" onClick={() => onDisconnectWallet(step.key)}>Disconnect</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn_primary" onClick={() => onConnectWallet(step.key)}>Connect Wallet</button>
                <button className="btn_secondary" onClick={() => { setErr(null); setI((x) => x + 1); }} title="You can connect later">Skip for now</button>
              </div>
            )}
            <div className="sub mt8">Optional: connecting helps verify your responses later.</div>
          </div>
        )}

        {step.type === "problem_block" && (
          <div className="mt12" style={{ display: "grid", gap: 12 }}>
            <div className="help" style={{ whiteSpace: "pre-wrap" }}>{step.problem}</div>

            <label>{step.labels?.scale || "How strongly do you relate to this? (1=No care, 5=Huge problem)"}</label>
            <input type="number" min={step.min} max={step.max}
              value={answers[scoreKey!] ?? ""}
              onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setAnswer(scoreKey!, n); }}
            />

            <label>{step.labels?.reason || "Why that score?"}</label>
            <textarea rows={4} value={answers[reasonKey!] || ""} onChange={(e) => setAnswer(reasonKey!, e.target.value)} />

            <label>{step.labels?.attempts || "Have you tried anything? How did it go?"}</label>
            <textarea rows={4} value={answers[attemptsKey!] || ""} onChange={(e) => setAnswer(attemptsKey!, e.target.value)} />
          </div>
        )}

        {step.type === "scale_with_preamble" && (
          <div className="mt12" style={{ display: "grid", gap: 10 }}>
            <div className="help" style={{ whiteSpace: "pre-wrap" }}>{step.preamble}</div>
            {step.label && <label>{step.label}</label>}
            <input type="number" min={step.min} max={step.max}
              value={answers[step.key] ?? ""}
              onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setAnswer(step.key, n); }}
            />
          </div>
        )}

        {step.type === "account_setup" && (() => {
          const fieldKey = step.key || "wallet";
          return (
            <div className="mt12" style={{ display: "grid", gap: 12 }}>
              <h2 className="step-title" style={{ marginTop: 0 }}>
                {step.title || step.label || "Account setup"}
              </h2>

              <div className="help" style={{ whiteSpace: "pre-wrap" }}>
                {step.copy || "Thanks for taking the time to help this company!"}
              </div>

              {answers[fieldKey] ? (
                <div className="row" style={{ alignItems: "center", gap: 8 }}>
                  <span className="pill">Connected: {String(answers[fieldKey])}</span>
                  <button className="btn_secondary" onClick={() => onDisconnectWallet(fieldKey)}>Disconnect</button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn_primary" onClick={() => onConnectWallet(fieldKey)}>
                      Connect wallet
                    </button>
                    <button className="btn_secondary" onClick={() => {
                      const returnUrl = encodeURIComponent(window.location.href);
                      window.open(`/tester/signin?returnTo=${returnUrl}`, '_blank');
                      // Show message to user
                      alert("Sign in page opened in new tab. You can continue with the questionnaire here while signing in.");
                    }}>
                      Sign in
                    </button>
                    <button className="btn_secondary" onClick={() => {
                      const returnUrl = encodeURIComponent(window.location.href);
                      window.open(`/tester/signup?returnTo=${returnUrl}`, '_blank');
                      // Show message to user
                      alert("Sign up page opened in new tab. You can continue with the questionnaire here while creating your account.");
                    }}>
                      Sign up
                    </button>
                  </div>
                  <button className="btn_secondary" onClick={() => setI((x) => x + 1)} title="You can connect later">
                    Skip for now
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {step.type === "pricing_models_block" && (() => {
          const s = step as any;
          const models: Array<{ key?: string; label?: string }> = Array.isArray(s.models) ? s.models : [];
          const min = s.min ?? 1, max = s.max ?? 5;

          return (
            <div className="mt12" style={{ display: "grid", gap: 12 }}>
              <h2 className="step-title" style={{ marginTop: 0 }}>
                {s.title || s.label || "Pricing feedback"}
              </h2>
              {s.preamble && (
                <div className="help" style={{ whiteSpace: "pre-wrap" }}>{s.preamble}</div>
              )}

              <div className="stack">
                {models.map((m, idx) => {
                  const key = m.key || `pricing_${idx + 1}`;
                  const label = m.label || `Pricing ${idx + 1}`;
                  return (
                    <div className="input-row" key={key}>
                      <label className="form-title">{label}</label>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={answers[key] ?? ""}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isNaN(n)) setAnswer(key, n);
                          else setAnswer(key, e.target.value);
                        }}
                      />
                      <div className="sub">Rate {min}–{max}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="actions mt16" style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={back} disabled={i === 0}>Back</button>
          {i < steps.length - 1 ? (
            <button className="btn primary" onClick={next}>Next</button>
          ) : (
            <button className="btn primary" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>

        {err && <div className="sub mt8" style={{ color: "#b42318" }}>{err}</div>}
      </div>
    </div>
  );
}

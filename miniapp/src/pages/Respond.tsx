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
      if (!sid) return;
      
      // Check authentication status first (only for testers, not founders)
      let authStatus = false;
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        // Only consider authenticated if user has tester role or tester email
        if (session?.user) {
          const userEmail = session.user.email;
          // Check if this is a tester (has verityTesterEmail in localStorage)
          const testerEmail = localStorage.getItem("verityTesterEmail");
          authStatus = testerEmail === userEmail;
        }
      } else {
        // Fallback to localStorage check
        const testerEmail = localStorage.getItem("verityTesterEmail");
        authStatus = !!testerEmail;
      }
      
      setIsAuthenticated(authStatus);
      
      // Check if user is signed in as a founder (has verityFounderEmail in localStorage)
      const founderEmail = localStorage.getItem("verityFounderEmail");
      if (founderEmail) {
        setErr("Founders cannot access questionnaire pages. Please sign out from the founder dashboard first.");
        return;
      }
      
      try {
        // Get user's email for resuming previous answers
        let userEmail = undefined;
        if (authStatus) {
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.email) {
              userEmail = session.user.email;
            }
          } else {
            userEmail = localStorage.getItem("verityTesterEmail") || undefined;
          }
        }
        
        // Get questions with previous answers if user is authenticated
        const endpoint = userEmail ? `/session_questions_with_answers` : `/session_questions`;
        const params = userEmail 
          ? { session_id: sid, tester_email: userEmail }
          : { session_id: sid };
          
        const { data } = await api.get(endpoint, { params });
        let stepsData = (data.steps || []) as Step[];
        
        // Skip account_setup step if user is authenticated
        if (authStatus) {
          stepsData = stepsData.filter(step => step.type !== "account_setup");
        }
        
        setSteps(stepsData);
        
        // Load previous answers if available
        if (data.previous_answers && Object.keys(data.previous_answers).length > 0) {
          setAnswers(data.previous_answers);
          
          // Find the first unanswered question to resume from
          let firstUnansweredIndex = 0;
          for (let i = 0; i < stepsData.length; i++) {
            const step = stepsData[i];
            const stepKey = step.key;
            
            // Skip optional steps
            if (step.type === "text" || step.type === "input_wallet" || step.type === "account_setup" || step.type === "input_email") {
              continue;
            }
            
            // Check if this step is answered
            let isAnswered = false;
            if (step.type === "problem_block") {
              const scoreKey = `${stepKey}_score`;
              const reasonKey = `${stepKey}_reason`;
              const attemptsKey = `${stepKey}_attempts`;
              isAnswered = data.previous_answers[scoreKey] && data.previous_answers[reasonKey] && data.previous_answers[attemptsKey];
            } else {
              isAnswered = data.previous_answers[stepKey];
            }
            
            if (!isAnswered) {
              firstUnansweredIndex = i;
              break;
            }
          }
          
          setI(firstUnansweredIndex);
        }
      } catch (e: any) {
        setErr(e?.response?.data?.detail || e.message || "Failed to load questions");
      }
    })();
  }, [sid]);

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

  // Calculate progress
  const answeredQuestions = Object.keys(answers).length;
  const totalQuestions = steps.filter(s => 
    s.type !== "text" && s.type !== "input_wallet" && s.type !== "account_setup" && s.type !== "input_email"
  ).length;
  const progressPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const isResuming = answeredQuestions > 0 && i > 0;

  return (
    <div className="container">
      <div className="card">
        <div className="sub">
          <span className="pill">Step {Math.min(i + 1, steps.length)} of {steps.length}</span>
          {isResuming && (
            <span className="pill" style={{ marginLeft: 8, backgroundColor: "#e6f4ff", color: "#1890ff" }}>
              Resuming... {progressPercentage}% complete
            </span>
          )}
        </div>

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

        <div className="actions mt16" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={back} disabled={i === 0}>Back</button>
          {isResuming && (
            <button 
              className="btn secondary" 
              onClick={() => {
                const answeredSteps = steps.filter((s, idx) => {
                  if (s.type === "text" || s.type === "input_wallet" || s.type === "account_setup" || s.type === "input_email") {
                    return false;
                  }
                  if (s.type === "problem_block") {
                    const scoreKey = `${s.key}_score`;
                    const reasonKey = `${s.key}_reason`;
                    const attemptsKey = `${s.key}_attempts`;
                    return answers[scoreKey] && answers[reasonKey] && answers[attemptsKey];
                  }
                  return answers[s.key];
                });
                
                const summary = answeredSteps.map(s => {
                  const answer = s.type === "problem_block" 
                    ? `Score: ${answers[`${s.key}_score`]}, Reason: ${answers[`${s.key}_reason`]?.substring(0, 50)}...`
                    : answers[s.key];
                  return `${s.label || s.key}: ${answer}`;
                }).join('\n');
                
                alert(`Your previous answers:\n\n${summary}`);
              }}
            >
              Review Answers
            </button>
          )}
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

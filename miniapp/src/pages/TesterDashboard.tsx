import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { connectWallet, disconnectWallet } from "../lib/nearWallet";

const API = import.meta.env.VITE_BACKEND_URL as string;

type TesterQuestionnaire = {
  session_id: string;
  company_name: string;
  founder_email: string;
  problem_domain: string;
  value_prop: string;
  created_at: string;
  is_completed: boolean;
  completion_percentage: number;
  total_questions: number;
  payment_amount: number;
  paid: boolean;
  last_response_at: string | null;
  share_link: string;
};

type TesterResponse = {
  id: string;
  session_id: string;
  created_at: string;
  answer_hash: string;
  answers: any;
  founder_email: string;
  company_name: string;
  problem_domain: string;
  session_status: string;
  payment_amount: number;
  paid: boolean;
};

export default function TesterDashboard() {
  const nav = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [questionnaires, setQuestionnaires] = useState<TesterQuestionnaire[]>([]);
  const [responses, setResponses] = useState<TesterResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"questionnaires" | "responses">("questionnaires");

  // Wallet connection functions
  async function onConnectWallet() {
    try {
      const res = await connectWallet();
      if (typeof res === "string") {
        setWalletConnected(res);
      } else if (res && typeof res === "object") {
        if (res.account) setWalletConnected(res.account);
      }
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Wallet connection failed");
      setTimeout(() => setErr(null), 2000);
    }
  }

  async function onDisconnectWallet() {
    try { 
      await disconnectWallet(); 
      setWalletConnected(null);
    } catch {}
  }

  useEffect(() => {
    (async () => {
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        // Fall back to existing localStorage method if Supabase not configured
        const fromStorage = localStorage.getItem("verityTesterEmail") || "";
        if (fromStorage) { 
          setEmail(fromStorage); 
          setSignedIn(true); 
        }
        return;
      }

      // Check if supabase client is available
      if (!supabase) {
        // Fall back to existing localStorage method if Supabase not available
        const fromStorage = localStorage.getItem("verityTesterEmail") || "";
        if (fromStorage) { 
          setEmail(fromStorage); 
          setSignedIn(true); 
        }
        return;
      }

      // Check if user is authenticated with Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // User is authenticated, use their email
        const authEmail = session.user.email;
        setEmail(authEmail || "");
        setSignedIn(true);
        localStorage.setItem("verityTesterEmail", authEmail || "");
      } else {
        // Fall back to existing localStorage method for backward compatibility
        const fromStorage = localStorage.getItem("verityTesterEmail") || "";
        if (fromStorage) { 
          setEmail(fromStorage); 
          setSignedIn(true); 
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!signedIn || !email) return;
    (async () => {
      setLoading(true);
      try {
        setErr(null);
        const e = email.trim().toLowerCase();
        
        // Get available questionnaires
        const qRes = await fetch(`${API}/tester_questionnaires?tester_email=${encodeURIComponent(e)}`);
        if (!qRes.ok) {
          const j = await qRes.json().catch(() => ({}));
          throw new Error(j?.detail || `HTTP ${qRes.status}`);
        }
        const qData = await qRes.json();
        setQuestionnaires(qData.questionnaires || []);

        // Get completed responses
        const rRes = await fetch(`${API}/tester_responses?tester_email=${encodeURIComponent(e)}`);
        if (!rRes.ok) {
          const j = await rRes.json().catch(() => ({}));
          throw new Error(j?.detail || `HTTP ${rRes.status}`);
        }
        const rData = await rRes.json();
        setResponses(rData.responses || []);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Failed to load data");
        setQuestionnaires([]);
        setResponses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [signedIn, email]);

  function fmt(ts?: string | null) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString(); } catch { return ts || "—"; }
  }

  function continueQuestionnaire(shareLink: string) {
    window.open(shareLink, '_blank');
  }

  if (!signedIn) {
    return (
      <div className="container">
        <div className="card">
          <h1>Tester Dashboard</h1>
          <div className="sub">Sign in to see your questionnaires and responses.</div>
          <div className="row" style={{ maxWidth: 440 }}>
            <label>Email</label>
            <input
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="btn_primary"
              onClick={() => {
                const e = email.trim().toLowerCase();
                if (!e.includes("@")) { alert("Enter a valid email"); return; }
                localStorage.setItem("verityTesterEmail", e);
                setEmail(e);
                setSignedIn(true);
              }}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h1>Tester Dashboard</h1>
            <div className="sub">Signed in as <code>{email}</code></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {walletConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="pill">Connected: {walletConnected}</span>
                <button className="btn_secondary" onClick={onDisconnectWallet}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button className="btn_primary" onClick={onConnectWallet}>
                Connect Wallet
              </button>
            )}
            <button
              className="btn_secondary"
              onClick={async () => {
                if (supabase) {
                  await supabase.auth.signOut();
                }
                localStorage.removeItem("verityTesterEmail");
                nav("/tester/signin");
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt16" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="sub">
            Available questionnaires: <strong>{questionnaires.length}</strong>
          </div>
          <div className="sub">
            Completed: <strong>{questionnaires.filter(q => q.is_completed).length}</strong>
          </div>
          <div className="sub">
            Total earned: <strong>${responses.reduce((sum, r) => sum + (r.payment_amount || 0), 0).toFixed(2)}</strong>
          </div>
          <div className="sub">
            Paid responses: <strong>{responses.filter(r => r.paid).length}</strong>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt16" style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)" }}>
          <button
            className={`btn_tab ${activeTab === "questionnaires" ? "active" : ""}`}
            onClick={() => setActiveTab("questionnaires")}
          >
            Available Questionnaires
          </button>
          <button
            className={`btn_tab ${activeTab === "responses" ? "active" : ""}`}
            onClick={() => setActiveTab("responses")}
          >
            Completed Responses
          </button>
        </div>

        <div className="mt16">
          {loading ? (
            <div className="sub">Loading…</div>
          ) : err ? (
            <div className="sub" style={{ color: "#b42318" }}>Error: {err}</div>
          ) : activeTab === "questionnaires" ? (
            questionnaires.length === 0 ? (
              <div className="sub">No questionnaires available yet. Check back later!</div>
            ) : (
              <div className="table sessions">
                                 <div className="thead" style={{ fontWeight: 600, color: "var(--muted)" }}>
                   <div>Company</div>
                   <div>Domain</div>
                   <div>Value Proposition</div>
                   <div>Completion</div>
                   <div>Payment</div>
                   <div>Actions</div>
                 </div>

                {questionnaires.map((q) => (
                  <div key={q.session_id} className="trow">
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <strong>{q.company_name}</strong>
                      <div className="sub" style={{ fontSize: "0.8em" }}>{q.founder_email}</div>
                    </div>
                    <div>{q.problem_domain}</div>
                    <div style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {q.value_prop}
                    </div>
                                         <div>
                       <div style={{ fontSize: "1.1em", fontWeight: "600" }}>
                         {q.completion_percentage}%
                       </div>
                       <div style={{ fontSize: "0.8em", color: "var(--muted)" }}>
                         {q.total_questions} questions
                       </div>
                     </div>
                     <div>
                       {q.payment_amount > 0 ? (
                         <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                           <span className={q.paid ? "badge active" : "badge draft"}>
                             ${q.payment_amount.toFixed(2)}
                           </span>
                           {q.paid && (
                             <span className="pill" style={{ fontSize: "0.7em" }}>✓ Paid</span>
                           )}
                         </div>
                       ) : (
                         <div style={{ fontSize: "0.8em", color: "var(--muted)" }}>
                           —
                         </div>
                       )}
                     </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button 
                        className="btn_primary" 
                        onClick={() => continueQuestionnaire(q.share_link)}
                      >
                        {q.is_completed ? "Continue" : "Start"}
                      </button>
                      {q.last_response_at && (
                        <span className="pill" style={{ fontSize: "0.7em" }}>
                          Last: {fmt(q.last_response_at)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Responses tab
            responses.length === 0 ? (
              <div className="sub">No responses yet. Complete some questionnaires to see them here!</div>
            ) : (
              <div className="table sessions">
                <div className="thead" style={{ fontWeight: 600, color: "var(--muted)" }}>
                  <div>Company</div>
                  <div>Domain</div>
                  <div>Submitted</div>
                  <div>Earnings</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>

                {responses.map((r) => (
                  <div key={r.id} className="trow">
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <strong>{r.company_name}</strong>
                      <div className="sub" style={{ fontSize: "0.8em" }}>{r.founder_email}</div>
                    </div>
                    <div>{r.problem_domain}</div>
                    <div>{fmt(r.created_at)}</div>
                    <div>
                      <span className={r.paid ? "badge active" : "badge draft"}>
                        ${r.payment_amount?.toFixed(2) || "0.00"}
                      </span>
                      {r.paid && <span className="pill" style={{ marginLeft: 4, fontSize: "0.7em" }}>✓ Paid</span>}
                    </div>
                    <div>
                      <span className={`badge ${r.session_status === "active" ? "active" : "draft"}`}>
                        {r.session_status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="pill_tag">Response</span>
                      <button className="btn_chip" onClick={() => alert("Response details coming soon!")}>
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

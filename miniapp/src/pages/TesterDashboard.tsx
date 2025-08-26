import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { connectWallet, disconnectWallet } from "../lib/nearWallet";

const API = import.meta.env.VITE_BACKEND_URL as string;

type TesterResponse = {
  id: string;
  session_id: string;
  created_at: string;
  answer_hash: string;
  answers: any;
  founder_email: string;
  session_title?: string;
};

export default function TesterDashboard() {
  const nav = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [responses, setResponses] = useState<TesterResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState<string | null>(null);

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
        
        // Get tester responses using the new endpoint
        const r = await fetch(`${API}/tester_responses?tester_email=${encodeURIComponent(e)}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.detail || `HTTP ${r.status}`);
        }
        const j = await r.json();
        setResponses(j.responses || []);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Failed to load responses");
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

  if (!signedIn) {
    return (
      <div className="container">
        <div className="card">
          <h1>Tester Dashboard</h1>
          <div className="sub">Sign in to see your responses and rewards.</div>
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
            Your responses <strong>{responses.length}</strong> total
          </div>
          <div className="sub">Rewards earned: <strong>0</strong> tokens</div>
        </div>

        <div className="mt16">
          {loading ? (
            <div className="sub">Loading…</div>
          ) : err ? (
            <div className="sub" style={{ color: "#b42318" }}>Error: {err}</div>
          ) : responses.length === 0 ? (
            <div className="sub">No responses yet. Complete some questionnaires to see them here!</div>
          ) : (
            <div className="table sessions">
              <div className="thead" style={{ fontWeight: 600, color: "var(--muted)" }}>
                <div>Session</div>
                <div>Submitted</div>
                <div>Founder</div>
                <div>Actions</div>
              </div>

              {responses.map((r) => (
                <div key={r.id} className="trow">
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.session_title || r.session_id}
                  </div>
                  <div>{fmt(r.created_at)}</div>
                  <div>{r.founder_email}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="pill_tag">Response</span>
                    <button className="btn_chip" onClick={() => alert("Response details coming soon!")}>
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

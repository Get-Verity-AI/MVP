import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function FounderSignin() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState<string|null>(null);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);

    if (!supabase) {
      setErr("Auth is disabled: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in miniapp/.env");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setErr(error.message);

    // ensure profile row exists
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess?.session?.user?.id;
    const uemail = sess?.session?.user?.email ?? email;
    if (uid) await supabase.from("founders").upsert({ user_id: uid, email: uemail });

    nav("/founder/dashboard");
  }

  return (
    <div className="container">
      <form className="card" onSubmit={submit}>
        <h2>Sign in</h2>
        <input className="mt12" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="mt12" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button className="btn_success mt12">Sign in</button>
        {err && <div className="sub mt8" style={{color:"#b42318"}}>{err}</div>}

        <div className="sub mt12">
          Don’t have an account? <Link to="/signup">Create one</Link>
        </div>
      </form>
    </div>
  );
}

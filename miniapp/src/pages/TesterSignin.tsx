import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function TesterSignin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error("Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.");
      }

      // Check if supabase client is available
      if (!supabase) {
        throw new Error("Supabase client not available. Please check your environment configuration.");
      }

      // Sign in with Supabase Auth
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Get session to ensure profile exists
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Store email in localStorage for compatibility with existing code
        localStorage.setItem("verityTesterEmail", session.user.email ?? email);
      }

      // Navigate to tester dashboard after successful signin
      nav("/tester/dashboard");
    } catch (error: any) {
      setErr(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Sign in to Verity</h1>
      <p className="opacity-80 mb-6">Welcome back! Sign in to view your responses and rewards.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm opacity-80">Email</label>
          <input 
            className="w-full px-3 py-2 rounded-xl border" 
            type="email" 
            required 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <label className="text-sm opacity-80">Password</label>
          <input 
            className="w-full px-3 py-2 rounded-xl border" 
            type="password" 
            required 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <button className="btn_success" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
      </form>
      <p className="mt-4 text-sm opacity-70">
        Don't have an account? <Link to="/tester/signup" className="text-blue-600">Sign up</Link>
      </p>
    </div>
  );
}

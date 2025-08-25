import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function TesterSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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

      // First, create Supabase auth user
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { display_name: name, user_type: 'tester' }
        }
      });
      
      if (error) throw error;

      // Store email in localStorage for compatibility
      localStorage.setItem("verityTesterEmail", email);

      // Always navigate to tester dashboard after successful signup
      nav("/tester/dashboard");
    } catch (error: any) {
      setErr(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Join Verity as a Tester</h1>
      <p className="opacity-80 mb-6">Create an account to track your responses and earn rewards.</p>
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
            minLength={6}
            value={password} 
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <label className="text-sm opacity-80">Name (optional)</label>
          <input 
            className="w-full px-3 py-2 rounded-xl border" 
            value={name} 
            onChange={e => setName(e.target.value)}
            disabled={loading}
          />
        </div>
        <button className="btn_success" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
        {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
      </form>
      <p className="mt-4 text-sm opacity-70">
        Already have an account? <Link to="/tester/signin" className="text-blue-600">Sign in</Link>
      </p>
    </div>
  );
}

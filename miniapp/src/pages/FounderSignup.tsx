import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function FounderSignup() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  const nav = useNavigate();
  const API = import.meta.env.VITE_BACKEND_URL;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(`${API}/founder/register`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email, display_name: name || null })
    });
    const j = await r.json();
    if (j?.ok) {
      setOk(true);
      setTimeout(()=> nav(`/founder/intro?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`), 500);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Create your Verity account</h1>
      <p className="opacity-80 mb-6">We’ll attach sessions and a dashboard to this email.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm opacity-80">Email</label>
          <input className="w-full px-3 py-2 rounded-xl border" type="email" required value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-sm opacity-80">Name respondents know you by (optional)</label>
          <input className="w-full px-3 py-2 rounded-xl border" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <button className="btn_success" type="submit">Create account</button>
        {ok && <div className="text-green-600 text-sm mt-2">Account created successfully</div>}
      </form>
    </div>
  );
}

import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function FounderIntro() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const email = useMemo(()=> sp.get("email") || "", [sp]);
  const name  = useMemo(()=> sp.get("name")  || "", [sp]);

  return (
    <div className="container max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Welcome{ name ? `, ${name}` : "" } 👋</h1>
      <p className="opacity-80 mb-4">
        You’ll answer a short founder questionnaire. Verity will generate a shareable
        interview link for your prospects/users. All responses will land in your Founder Dashboard.
      </p>
      <div className="rounded-2xl border p-4 mb-6">
        <strong>How it works</strong>
        <ol className="list-decimal ml-6 mt-2 space-y-1">
          <li>Answer ~10–12 questions about your product and audience.</li>
          <li>We create a respondent questionnaire + a share link (and a Telegram deep link).</li>
          <li>You share the link; responses appear in your dashboard.</li>
        </ol>
      </div>
      <button
        className="btn_success"
        onClick={()=> nav(`/founder/new?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`)}
      >
        Ready to proceed
      </button>
    </div>
  );
}

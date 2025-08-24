import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";

type LocState = { sid?: string; share?: string | null };

export default function FounderShare() {
  const { state } = useLocation() as { state?: LocState };
  const [sp] = useSearchParams();

  // Allow both state and URL (so refresh works)
  const sid = state?.sid || sp.get("sid") || "";
  const bot = (import.meta.env as any).VITE_BOT_USERNAME || "";

  const tgDeep = useMemo(() => (bot && sid ? `https://t.me/${bot}?startapp=sid_${sid}` : null), [bot, sid]);
  const preview = useMemo(() => (sid ? `/respond?sid=${sid}` : null), [sid]);

  // Prefer backend-provided share link; fallback to tgDeep; fallback to origin+preview
  const primaryShare = useMemo(() => {
    if (state?.share) return state.share;
    if (tgDeep) return tgDeep;
    if (preview) return `${location.origin}${preview}`;
    return "";
  }, [state?.share, tgDeep, preview]);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (!sid) {
    return (
      <div className="container">
        <div className="card">
          <h1>Missing session</h1>
          <div className="sub mt8">No session id was provided.</div>
          <div className="actions mt16">
            <Link className="btn_chip" to="/founder/dashboard">Open Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Questionnaire created 🎉</h1>
        <div className="sub mt8">
          Questionnaire was successfully created, you can share it with your prospects.
        </div>

        <div className="mt12">
          <label>Shareable link</label>
          <input readOnly value={primaryShare} />
        </div>

        <div className="actions mt16">
          {preview && (
            <a className="btn_chip" href={preview} target="_blank" rel="noreferrer">
              Preview
            </a>
          )}

          <button
            className={`btn_chip ${copied ? "copied" : ""}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(primaryShare);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                // basic fallback if clipboard API blocked
                const tmp = document.createElement("textarea");
                tmp.value = primaryShare;
                document.body.appendChild(tmp);
                tmp.select();
                document.execCommand("copy");
                document.body.removeChild(tmp);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }
            }}
          >
            {copied ? "Copied!" : "Share"}
          </button>

          <a className="btn_chip" href="/founder/dashboard">
            Open Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

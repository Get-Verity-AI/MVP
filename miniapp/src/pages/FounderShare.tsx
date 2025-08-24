import { useLocation, useSearchParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

type LocState = { sid?: string; share?: string | null };

export default function FounderShare() {
  const { state } = useLocation() as { state?: LocState };
  const [sp] = useSearchParams();

  // sid can come from router state OR from the URL (?sid=...)
  const sid = (state?.sid || sp.get("sid") || "").toString().trim();

  // Build the questionnaire preview path and the full share URL
  const previewPath = useMemo(() => (sid ? `/respond?sid=${sid}` : null), [sid]);
  const shareUrl = useMemo(
    () => (previewPath ? `${location.origin}${previewPath}` : ""),
    [previewPath]
  );

  const [copied, setCopied] = useState(false);

  // Smooth scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Clipboard with fallback for non-secure contexts
  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (!sid) {
    return (
      <div className="container">
        <div className="card">
          <h1>Missing session</h1>
          <div className="sub mt8">No session id was provided.</div>
          <div className="actions mt16" style={{ display: "flex", gap: 8 }}>
            <Link className="btn_chip" to="/founder/new">Create New</Link>
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
          <input readOnly value={shareUrl} />
        </div>

        <div className="actions mt16" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {previewPath && (
            <a className="btn_chip" href={previewPath} target="_blank" rel="noreferrer">
              Preview
            </a>
          )}

          <button
            className={`btn_chip ${copied ? "copied" : ""}`}
            onClick={copyShareUrl}
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

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { FounderInputsStreamlit } from "../types";

const API = import.meta.env.VITE_BACKEND_URL;

const PRICING_MODELS = [
  "Free - no charge",
  "Subscription",
  "One-time",
  "Freemium",
  "Usage-based",
  "Other",
];

const ACTION_OPTIONS = [
  { key: "join_waitlist", label: "Join the product waitlist" },
  { key: "download_app",  label: "Download the app now" },
  { key: "share_email",   label: "Share email for updates" },
  { key: "follow_x",      label: "Follow on X for updates" },
];

type StepDef = {
  key: string;
  title: string;
  render: () => JSX.Element;
  valid: () => boolean;
  final?: boolean;
};

const numberize = (s: string) => {
  const n = Number((s || "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

export default function FounderNew() {
  const [sp] = useSearchParams();
  const nav = useNavigate();

  // ---- email: from URL ? from localStorage ? empty
  const emailFromUrl = useMemo(() => sp.get("email") || "", [sp]);
  const [founderEmail, setFounderEmail] = useState<string>(
    emailFromUrl || localStorage.getItem("verityFounderEmail") || ""
  );
  const emailValid = founderEmail.includes("@");

  // identity
  const [displayName, setDisplayName] = useState<string>(sp.get("name") || "");
  const [industry, setIndustry]       = useState<string>("");

  // problems
  const [p1, setP1] = useState(""); const [p2, setP2] = useState(""); const [p3, setP3] = useState("");

  // segments
  const [segmentMode, setSegmentMode] = useState<"one"|"decide">("one");
  const [segments, setSegments] = useState<string[]>([""]);
  const setSeg = (i:number,v:string)=> setSegments(s=> s.map((x,idx)=> idx===i? v:x));
  const addSeg = ()=> setSegments(s=> [...s,""]);
  const delSeg = (i:number)=> setSegments(s=> s.filter((_,idx)=> idx!==i));

  // pitch
  const [pitch, setPitch] = useState("");

  // pricing
  const [isPaid, setIsPaid] = useState<"yes"|"no">("yes");
  const [pricingModel, setPricingModel] = useState<string>(PRICING_MODELS[0]);
  const [pricingModelConsidered, setPricingModelConsidered] = useState<string[]>([]);
  const toggleConsidered = (m:string)=> setPricingModelConsidered(a=> a.includes(m)? a.filter(x=>x!==m) : [...a,m]);

  const [price1, setPrice1] = useState(""); const [price2, setPrice2] = useState(""); const [price3, setPrice3] = useState("");
  const isFreeChoice = pricingModel === "Free - no charge" || isPaid === "no";

  // actions
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [actionOther, setActionOther] = useState("");
  const toggleAction = (k:string)=> setSelectedActions(a=> a.includes(k)? a.filter(x=>x!==k): [...a,k]);

  // feedback
  const [founderFeedback, setFounderFeedback] = useState("");

  // stepper
  const [step, setStep] = useState(0);

  // success state
  const [sid, setSid] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // error state
  const [err, setErr] = useState<string | null>(null);
  const clearErrSoon = () => setTimeout(() => setErr(null), 2500);

  const steps: StepDef[] = [
    {
      key: "identity",
      title: "Founder Inputs",
      render: () => (
        <>
          <p className="form-hint">
            Please set aside 15 minutes. The clearer your inputs, the better the insight Verity can gather for you.
          </p>
          <div className="form-section">
            <label>What name will most of your respondents know you by?</label>
            <input value={displayName} onChange={e=>setDisplayName(e.target.value)} />
          </div>
          <div className="form-section">
            <label>What industry or area are you / your project focusing on?</label>
            <input value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="e.g., insurance" />
          </div>
        </>
      ),
      valid: () => true
    },
    {
      key: "problems",
      title: "What specific problem(s) are you solving? (max 3)",
      render: () => (
        <>
          <p className="form-hint">Describe up to 3 key problems your target users face.</p>
          <div className="stack">
            <div className="input-row"><input placeholder="Problem 1" value={p1} onChange={e=>setP1(e.target.value)} /></div>
            <div className="input-row"><input placeholder="Problem 2 (optional)" value={p2} onChange={e=>setP2(e.target.value)} /></div>
            <div className="input-row"><input placeholder="Problem 3 (optional)" value={p3} onChange={e=>setP3(e.target.value)} /></div>
          </div>
        </>
      ),
      valid: () => p1.trim().length > 0
    },
    {
      key: "segments",
      title: "How many distinct target user groups will you invite?",
      render: () => (
        <>
          <div className="form-section">
            <div className="v-choice">
              <input id="seg-one" type="radio" name="segmode" checked={segmentMode==="one"} onChange={()=>setSegmentMode("one")} />
              <label htmlFor="seg-one">I’m focused on one user group</label>
            </div>
            <div className="v-choice">
              <input id="seg-decide" type="radio" name="segmode" checked={segmentMode==="decide"} onChange={()=>setSegmentMode("decide")} />
              <label htmlFor="seg-decide">I’m trying to decide between groups</label>
            </div>
          </div>
          <p className="form-hint">List the different groups; respondents will choose one so you can segment.</p>
          {segments.map((g,i)=>(
            <div key={i} style={{display:"flex", gap:8, marginTop:8}}>
              <input className="flex-1" value={g} placeholder={`Group ${i+1}`} onChange={e=>setSeg(i,e.target.value)} />
              <button type="button" className="btn_secondary" onClick={()=>delSeg(i)}>−</button>
              <button type="button" className="btn_secondary" onClick={addSeg}>＋</button>
            </div>
          ))}
        </>
      ),
      valid: () => segments.some(s => s.trim().length>0)
    },
    {
      key: "pitch",
      title: "What’s your pitch?",
      render: () => (
        <input
          placeholder="“We do [this] so users can unlock [value]”"
          value={pitch}
          onChange={e=>setPitch(e.target.value)}
        />
      ),
      valid: () => true
    },
    {
      key: "pricing1",
      title: "Pricing Information",
      render: () => (
        <>
          <div className="form-section">
            <div className="form-title">Is this a paid service?</div>
            <div className="v-choice">
              <input id="paid-yes" type="radio" name="ispaid" checked={isPaid==="yes"} onChange={()=>setIsPaid("yes")} />
              <label htmlFor="paid-yes">Paid service</label>
            </div>
            <div className="v-choice">
              <input id="paid-no" type="radio" name="ispaid" checked={isPaid==="no"} onChange={()=>setIsPaid("no")} />
              <label htmlFor="paid-no">Not paid</label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-title">What is your pricing model?</div>
            <div className="stack">
              {PRICING_MODELS.map(m=>(
                <div className="v-choice" key={m}>
                  <input id={`pm-${m}`} type="radio" name="pricing_model" checked={pricingModel===m} onChange={()=>setPricingModel(m)} />
                  <label htmlFor={`pm-${m}`}>{m}</label>
                </div>
              ))}
            </div>
          </div>
        </>
      ),
      valid: () => true
    },
    
    {
      key: "prices",
      title: "Price Points to Test (up to 3)",
      render: () => (
        <>
          {isFreeChoice && (
            <p className="form-hint">
              Price points are disabled because you selected a free / no-charge model.
            </p>
          )}
          <div className="stack">
            <div className="price-input">
              <input
                placeholder="Price Point 1"
                value={price1}
                onChange={e=>setPrice1(e.target.value)}
                disabled={isFreeChoice}
              />
            </div>
            <div className="price-input">
              <input
                placeholder="Price Point 2 (optional)"
                value={price2}
                onChange={e=>setPrice2(e.target.value)}
                disabled={isFreeChoice}
              />
            </div>
            <div className="price-input">
              <input
                placeholder="Price Point 3 (optional)"
                value={price3}
                onChange={e=>setPrice3(e.target.value)}
                disabled={isFreeChoice}
              />
            </div>
          </div>
        </>
      ),
      valid: () =>
        isFreeChoice ||
        numberize(price1) !== null ||
        numberize(price2) !== null ||
        numberize(price3) !== null
    },
    {
      key: "actions",
      title: "What action shows real interest now?",
      render: () => (
        <>
          <div className="stack">
            {ACTION_OPTIONS.map(o=>(
              <div className="v-choice" key={o.key}>
                <input id={`act-${o.key}`} type="checkbox"
                       checked={selectedActions.includes(o.key)}
                       onChange={()=>toggleAction(o.key)} />
                <label htmlFor={`act-${o.key}`}>{o.label}</label>
              </div>
            ))}
          </div>
          <div className="form-section">
            <label>Other:</label>
            <input value={actionOther} onChange={e=>setActionOther(e.target.value)} placeholder="Describe…" />
          </div>
        </>
      ),
      valid: () => selectedActions.length>0 || actionOther.trim().length>0
    },
    {
      key: "feedback",
      title: "Feedback to the Verity team (optional)",
      render: () => (
        <textarea
          className="min-h-[100px]"
          value={founderFeedback}
          onChange={e=>setFounderFeedback(e.target.value)}
          placeholder="What should we add or change?"
        />
      ),
      valid: () => true,
      final: true
    }
  ];

  const cur = steps[step];
  const isLast = !!cur.final;

  const next = () => {
    setErr(null);
    if (!cur.valid()) { setErr("Please complete this step."); clearErrSoon(); return; }
    setStep(s => Math.min(s+1, steps.length-1));
  };
  const back = () => { setErr(null); setStep(s => Math.max(0, s-1)); };

 // REMOVE these states at the top:
// const [sid, setSid] = useState<string | null>(null);
// const [share, setShare] = useState<string | null>(null);
// const [copied, setCopied] = useState(false);

// ... keep everything else

async function createSession() {
  setErr(null);
  if (!emailValid) { setErr("Please enter a valid email at the top."); clearErrSoon(); return; }

  const problems = [p1,p2,p3].map(s=>s.trim()).filter(Boolean);
  const price_points_raw = [price1,price2,price3].map(numberize).filter((n): n is number => n!==null);
  const target_segments = segments.map(s=> s.trim()).filter(Boolean);
  const actuallyPaid = !(pricingModel === "Free - no charge" || isPaid === "no");

  const payload: FounderInputsStreamlit = {
    email: founderEmail,
    founder_display_name: displayName || null,
    problem_domain: industry || null,
    problems,
    value_prop: pitch || null,
    is_paid_service: actuallyPaid,
    pricing_model: pricingModel,
    pricing_model_considered: [], // or remove if backend doesn't need it
    price_points: actuallyPaid ? price_points_raw : [],
    pricing_questions: [],
    segment_mode: segmentMode,
    target_segments,
    target_actions: [
      ...selectedActions,
      ...(actionOther.trim() ? [`other:${actionOther.trim()}`] : [])
    ],
    founder_feedback: founderFeedback || null,
    target_audience: null,
    target_action: null,
    follow_up_action: null,
  };

  try {
    const r = await fetch(`${API}/session_sb`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (!r.ok) { setErr(j?.detail || "Failed to create session"); clearErrSoon(); return; }

    if (j?.session_id) {
      localStorage.setItem("verityFounderEmail", founderEmail || "");
      // 👇 redirect to the success page and pass data
      nav("/founder/share", { state: { sid: j.session_id, share: j.share_link || null } });
    } else {
      setErr("Unexpected response from server.");
      clearErrSoon();
    }
  } catch (e: any) {
    setErr(e?.message || "Network error");
    clearErrSoon();
  }
}

  // ---------- Post-creation success panel ----------
  if (sid) {
    const bot = (import.meta.env as any).VITE_BOT_USERNAME || "";
    const tgDeep = bot ? `https://t.me/${bot}?startapp=sid_${sid}` : null;
    const preview = `/respond?sid=${sid}`;
    const dash = `/founder/dashboard`;

    const primaryShare = share || tgDeep || (location.origin + preview);

    return (
      <div className="container">
        <div className="card">
          <h1>Interview ready to share 🎉</h1>
          <div className="sub mt8">Cool — now you can share this questionnaire with your prospects.</div>

          <div className="mt12">
            <label>Shareable link</label>
            <input readOnly value={primaryShare} />
          </div>

          <div className="mt16">
            <span className="pill_tag">Questionnaire</span>
          </div>

          <div className="actions mt16">
            <a className="btn_chip" href={preview} target="_blank" rel="noreferrer">Preview</a>
            <button
              className={`btn_chip ${copied ? "copied" : ""}`}
              onClick={async () => {
                await navigator.clipboard.writeText(primaryShare);
                setCopied(true);
                setTimeout(()=>setCopied(false), 1200);
              }}
            >
              {copied ? "Copied!" : "Share"}
            </button>
            {tgDeep && <a className="btn_chip" href={tgDeep} target="_blank" rel="noreferrer">TG Verity</a>}
            <a className="btn_chip" href={dash}>Open Dashboard</a>
          </div>
        </div>
      </div>
    );
  }
  // -------------------------------------------------

  return (
    <div className="container">
      {/* small sign-in strip */}
      <div className="card email-strip">
        <div className="row" style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"end" }}>
          <div>
            <label>Founder email</label>
            <input
              placeholder="you@example.com"
              value={founderEmail}
              onChange={(e)=>setFounderEmail(e.target.value)}
            />
          </div>
          <button
            className="btn_primary"
            onClick={()=>{
              if (!emailValid) { setErr("Enter a valid email"); clearErrSoon(); return; }
              localStorage.setItem("verityFounderEmail", founderEmail);
            }}
          >
            Use this email
          </button>
        </div>
        {!emailValid && <div className="sub" style={{color:"#b42318", marginTop:6}}>Email is required to create a session.</div>}
      </div>

      <div className="stepper-head">
        <h1>Founder Inputs</h1>
        <div className="stepper-count">Step {step+1} of {steps.length}</div>
      </div>

      <div className="card">
        <h2 style={{marginBottom:12}}>{cur.title}</h2>
        <div className="form-section">{cur.render()}</div>

        {err && <div style={{ color:"#b42318", marginTop:10 }}>{err}</div>}

        <div className="stepper-btns">
          <button onClick={back} disabled={step===0}>Back</button>
          {!isLast ? (
            <button className="btn_success" onClick={next}>Next</button>
          ) : (
            <button className="btn_success" onClick={createSession} disabled={!emailValid}>
              Create Interview Session
            </button>
          )}
          <a className="btn_secondary" href="/founder/dashboard">Open Dashboard</a>
        </div>
      </div>
    </div>
  );
}

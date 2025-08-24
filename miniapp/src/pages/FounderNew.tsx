import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { FounderInputsStreamlit } from "../types";

const API = import.meta.env.VITE_BACKEND_URL;
const PRICING_MODELS = ["Subscription","One-time","Freemium","Usage-based","Other"];
const ACTION_OPTIONS = [
  { key:"join_waitlist", label:"Join the product waitlist" },
  { key:"download_app",  label:"Download the app now" },
  { key:"share_email",   label:"Share email for updates" },
  { key:"follow_x",      label:"Follow on X for updates" },
];

export default function FounderNew() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const founder_email = useMemo(()=> sp.get("email") || "", [sp]);
  const founder_name  = useMemo(()=> sp.get("name")  || "", [sp]);

  // identity
  const [displayName, setDisplayName] = useState<string>(founder_name || "");
  const [industry, setIndustry]       = useState<string>("");

  // problems (max 3)
  const [p1, setP1] = useState(""); const [p2, setP2] = useState(""); const [p3, setP3] = useState("");

  // target groups
  const [segmentMode, setSegmentMode] = useState<"one"|"decide">("one");
  const [segments, setSegments] = useState<string[]>([""]);
  const setSeg = (i:number,v:string)=> setSegments(s=> s.map((x,idx)=> idx===i? v:x));
  const addSeg = ()=> setSegments(s=> [...s,""]);
  const delSeg = (i:number)=> setSegments(s=> s.filter((_,idx)=> idx!==i));

  // pitch
  const [pitch, setPitch] = useState("");

  // pricing
  const [isPaid, setIsPaid] = useState<"yes"|"no">("yes");
  const [pricingModel, setPricingModel] = useState<string>("Subscription");
  const [pricingModelConsidered, setPricingModelConsidered] = useState<string[]>([]);
  const toggleConsidered = (m:string)=> setPricingModelConsidered(a=> a.includes(m)? a.filter(x=>x!==m) : [...a,m]);

  const [price1, setPrice1] = useState(""); const [price2, setPrice2] = useState(""); const [price3, setPrice3] = useState("");
  const numberize = (s:string)=> { const n = Number((s||"").replace(/,/g,"").trim()); return Number.isFinite(n) ? n : null; };

  // actions
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [actionOther, setActionOther] = useState("");
  const toggleAction = (k:string)=> setSelectedActions(a=> a.includes(k)? a.filter(x=>x!==k): [...a,k]);

  // feedback
  const [founderFeedback, setFounderFeedback] = useState("");

  // stepper
  const [step, setStep] = useState(0);

  const steps = [
    {
      key: "identity",
      title: "Founder Inputs",
      render: () => (
        <>
          <p className="form-hint">Please set aside 15 minutes. The clearer your inputs, the better the insight Verity can gather for you.</p>
          <div className="form-section">
            <label>What name will most of your respondents know you by?</label>
            <input className="w-full px-3 py-2 rounded-xl border" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
          </div>
          <div className="form-section">
            <label>What industry or area are you / your project focusing on?</label>
            <input className="w-full px-3 py-2 rounded-xl border" value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="e.g., insurance" />
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
            <div className="input-row"><input className="w-full px-3 py-2 rounded-xl border" placeholder="Problem 1" value={p1} onChange={e=>setP1(e.target.value)} /></div>
            <div className="input-row"><input className="w-full px-3 py-2 rounded-xl border" placeholder="Problem 2 (optional)" value={p2} onChange={e=>setP2(e.target.value)} /></div>
            <div className="input-row"><input className="w-full px-3 py-2 rounded-xl border" placeholder="Problem 3 (optional)" value={p3} onChange={e=>setP3(e.target.value)} /></div>
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
            <div key={i} className="actions-row">
              <input className="flex-1 px-3 py-2 rounded-xl border" value={g} placeholder={`Group ${i+1}`} onChange={e=>setSeg(i,e.target.value)} />
              <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>delSeg(i)}>−</button>
              <button type="button" className="px-3 py-2 rounded-xl border" onClick={addSeg}>＋</button>
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
        <input className="w-full px-3 py-2 rounded-xl border"
               placeholder="“We do [this] so users can unlock [value]”"
               value={pitch} onChange={e=>setPitch(e.target.value)} />
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
      key: "pricing2",
      title: "What pricing model are you considering?",
      render: () => (
        <div className="stack">
          {PRICING_MODELS.map(m=>(
            <div className="v-choice" key={m}>
              <input id={`pmc-${m}`} type="checkbox"
                     checked={pricingModelConsidered.includes(m)}
                     onChange={()=>toggleConsidered(m)} />
              <label htmlFor={`pmc-${m}`}>{m}</label>
            </div>
          ))}
        </div>
      ),
      valid: () => true
    },
    {
      key: "prices",
      title: "Price Points to Test (up to 3)",
      render: () => (
        <div className="stack">
          <div className="price-input"><input className="px-3 py-2 rounded-xl border w-full" placeholder="Price Point 1" value={price1} onChange={e=>setPrice1(e.target.value)} /></div>
          <div className="price-input"><input className="px-3 py-2 rounded-xl border w-full" placeholder="Price Point 2 (optional)" value={price2} onChange={e=>setPrice2(e.target.value)} /></div>
          <div className="price-input"><input className="px-3 py-2 rounded-xl border w-full" placeholder="Price Point 3 (optional)" value={price3} onChange={e=>setPrice3(e.target.value)} /></div>
        </div>
      ),
      valid: () => numberize(price1)!==null || numberize(price2)!==null || numberize(price3)!==null
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
            <input className="w-full px-3 py-2 rounded-xl border" value={actionOther} onChange={e=>setActionOther(e.target.value)} placeholder="Describe…" />
          </div>
        </>
      ),
      valid: () => selectedActions.length>0 || actionOther.trim().length>0
    },
    {
      key: "feedback",
      title: "Feedback to the Verity team (optional)",
      render: () => (
        <textarea className="w-full px-3 py-2 rounded-xl border min-h-[100px]"
                  value={founderFeedback}
                  onChange={e=>setFounderFeedback(e.target.value)}
                  placeholder="What should we add or change?" />
      ),
      valid: () => true,
      final: true
    }
  ];

  const cur = steps[step];
  const isLast = !!cur.final;

  const next = () => {
    if (!cur.valid()) return alert("Please complete this step.");
    setStep(s => Math.min(s+1, steps.length-1));
  };

  const back = () => setStep(s => Math.max(0, s-1));

  const createSession = async () => {
    const problems = [p1,p2,p3].map(s=>s.trim()).filter(Boolean);
    const price_points = [price1,price2,price3].map(numberize).filter((n): n is number => n!==null);
    const target_segments = segments.map(s=> s.trim()).filter(Boolean);

    const payload: FounderInputsStreamlit = {
      email: founder_email,
      founder_display_name: displayName || null,
      problem_domain: industry || null,
      problems,
      value_prop: pitch || null,
      is_paid_service: isPaid === "yes",
      pricing_model: pricingModel,
      pricing_model_considered: pricingModelConsidered,
      price_points,
      pricing_questions: [],
      segment_mode: segmentMode,
      target_segments,
      target_actions: [
        ...selectedActions,
        ...(actionOther.trim() ? [`other:${actionOther.trim()}`] : [])
      ],
      founder_feedback: founderFeedback || null,
    };

    const r = await fetch(`${API}/session_sb`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (j?.session_id) {
      nav(`/founder/dashboard?email=${encodeURIComponent(founder_email)}`);
    } else {
      alert("Failed to create session");
    }
  };

  return (
    <div className="container max-w-3xl mx-auto p-6">
      <div className="stepper-head">
        <h1 className="text-3xl font-bold">{cur.title || "Founder Inputs"}</h1>
        <div className="stepper-count">Step {step+1} of {steps.length}</div>
      </div>

      <div className="form-section">
        {cur.render()}
      </div>

      <div className="stepper-btns">
        <button onClick={back} disabled={step===0}>Back</button>
        {!isLast ? (
          <button className="btn_success" onClick={next}>Next</button>
        ) : (
          <button className="btn_success" onClick={createSession}>Create Interview Session</button>
        )}
        <a className="btn_secondary" href={`/founder/dashboard?email=${encodeURIComponent(founder_email)}`} target="_blank" rel="noreferrer">
          Open Dashboard
        </a>
      </div>
    </div>
  );
}

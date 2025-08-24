import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { FounderInputsStreamlit } from "../types";

const API = import.meta.env.VITE_BACKEND_URL;
const PRICING_MODELS = ["Subscription","One-time","Freemium","Usage-based","Other"];
const ACTION_OPTIONS = [
  { key:"join_waitlist", label:"join the product waitlist" },
  { key:"download_app",  label:"download the app now" },
  { key:"share_email",   label:"share email for updates" },
  { key:"follow_x",      label:"follow on X for updates" },
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

  // optional feedback
  const [founderFeedback, setFounderFeedback] = useState("");

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
      // redirect straight to dashboard as requested
      nav(`/founder/dashboard?email=${encodeURIComponent(founder_email)}`);
    } else {
      alert("Failed to create session");
    }
  };

  return (
    <div className="container max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Founder Inputs</h1>
      <p className="opacity-70 mb-6">Please set aside 15 minutes. The clearer your inputs, the better the insight Verity can gather for you.</p>

      {/* name */}
      <div className="mb-4">
        <label className="text-sm opacity-80">What name will most of your respondents know you by?</label>
        <input className="w-full px-3 py-2 rounded-xl border" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
      </div>

      {/* industry */}
      <div className="mb-6">
        <label className="text-sm opacity-80">What industry or area are you / your project focusing on?</label>
        <input className="w-full px-3 py-2 rounded-xl border" value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="e.g., insurance" />
      </div>

      {/* problems */}
      <h3 className="text-xl font-semibold mb-2">What specific problem(s) are you solving? (max 3)</h3>
      <p className="opacity-70 mb-2">Describe up to 3 key problems your target users face.</p>
      <div className="space-y-3 mb-6">
        <input className="w-full px-3 py-2 rounded-xl border" placeholder="Problem 1" value={p1} onChange={e=>setP1(e.target.value)} />
        <input className="w-full px-3 py-2 rounded-xl border" placeholder="Problem 2 (optional)" value={p2} onChange={e=>setP2(e.target.value)} />
        <input className="w-full px-3 py-2 rounded-xl border" placeholder="Problem 3 (optional)" value={p3} onChange={e=>setP3(e.target.value)} />
      </div>

      {/* segments */}
      <h3 className="text-xl font-semibold mb-2">How many distinct target user groups will you invite?</h3>
      <div className="flex gap-4 mb-3">
        <label><input type="radio" checked={segmentMode==="one"} onChange={()=>setSegmentMode("one")} /> I’m focused on one user group</label>
        <label><input type="radio" checked={segmentMode==="decide"} onChange={()=>setSegmentMode("decide")} /> I’m trying to decide between groups</label>
      </div>
      <p className="opacity-70 mb-2">List the different groups; respondents will choose one so you can segment.</p>
      {segments.map((g,i)=>(
        <div key={i} className="flex gap-2 mb-2 items-center">
          <input className="flex-1 px-3 py-2 rounded-xl border" value={g} placeholder={`Group ${i+1}`} onChange={e=>setSeg(i,e.target.value)} />
          <button type="button" className="px-3 py-2 rounded-xl border" onClick={()=>delSeg(i)}>−</button>
          <button type="button" className="px-3 py-2 rounded-xl border" onClick={addSeg}>＋</button>
        </div>
      ))}

      {/* pitch */}
      <h3 className="text-xl font-semibold mb-2 mt-4">What’s your pitch?</h3>
      <input className="w-full px-3 py-2 rounded-xl border mb-6" placeholder='“We do [this] so users can unlock [value]”' value={pitch} onChange={e=>setPitch(e.target.value)} />

      {/* pricing */}
      <h3 className="text-xl font-semibold mb-2">Pricing Information</h3>
      <div className="mb-3">
        <label className="mr-4"><input type="radio" checked={isPaid==="yes"} onChange={()=>setIsPaid("yes")} /> Paid service</label>
        <label><input type="radio" checked={isPaid==="no"} onChange={()=>setIsPaid("no")} /> Not paid</label>
      </div>

      <div className="mb-3">
        <div className="text-sm opacity-80">What is your pricing model?</div>
        <div className="flex flex-wrap gap-3 mt-2">
          {PRICING_MODELS.map(m=>(
            <label key={m} className="px-3 py-2 rounded-xl border cursor-pointer">
              <input type="radio" name="pricing_model" className="mr-2" checked={pricingModel===m} onChange={()=>setPricingModel(m)} />
              {m}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-sm opacity-80">What pricing model are you considering?</div>
        <div className="flex flex-wrap gap-3 mt-2">
          {PRICING_MODELS.map(m=>(
            <label key={m} className="px-3 py-2 rounded-xl border cursor-pointer">
              <input type="checkbox" className="mr-2" checked={pricingModelConsidered.includes(m)} onChange={()=>toggleConsidered(m)} />
              {m}
            </label>
          ))}
        </div>
      </div>

      <h4 className="font-semibold mb-2">Price Points to Test (up to 3)</h4>
      <div className="space-y-3 mb-6">
        <input className="w-full px-3 py-2 rounded-xl border" placeholder="Price Point 1" value={price1} onChange={e=>setPrice1(e.target.value)} />
        <input className="w-full px-3 py-2 rounded-xl border" placeholder="Price Point 2 (optional)" value={price2} onChange={e=>setPrice2(e.target.value)} />
        <input className="w-full px-3 py-2 rounded-xl border" placeholder="Price Point 3 (optional)" value={price3} onChange={e=>setPrice3(e.target.value)} />
      </div>

      {/* actions */}
      <h3 className="text-xl font-semibold mb-2">What action shows real interest now?</h3>
      <div className="flex flex-col gap-2 mb-3">
        {ACTION_OPTIONS.map(o=>(
          <label key={o.key}><input type="checkbox" className="mr-2" checked={selectedActions.includes(o.key)} onChange={()=>toggleAction(o.key)} /> {o.label}</label>
        ))}
        <div className="flex gap-2 items-center">
          <label className="whitespace-nowrap">Other:</label>
          <input className="flex-1 px-3 py-2 rounded-xl border" value={actionOther} onChange={e=>setActionOther(e.target.value)} placeholder="Describe…" />
        </div>
      </div>

      {/* feedback */}
      <h3 className="text-xl font-semibold mb-2">Feedback to the Verity team (optional)</h3>
      <textarea className="w-full px-3 py-2 rounded-xl border min-h-[100px]" value={founderFeedback} onChange={e=>setFounderFeedback(e.target.value)} placeholder="What should we add or change?" />

      <div className="mt-6 flex gap-3">
        <button className="btn_success" onClick={createSession}>Create Interview Session</button>
        <a className="btn_secondary" href={`/founder/dashboard?email=${encodeURIComponent(founder_email)}`} target="_blank" rel="noreferrer">
          Open Dashboard
        </a>
      </div>
    </div>
  );
}

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from Crypto.Hash import keccak
import hashlib, json, os, glob, uuid
from uuid import uuid4


# -----------------------------------------------------------------------------
# App & CORS
# -----------------------------------------------------------------------------
app = FastAPI(title="Verity Backend", version="0.3.0")

load_dotenv()
SB_URL = os.getenv("SUPABASE_URL")
SB_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
sb: Client | None = create_client(SB_URL, SB_KEY) if (SB_URL and SB_KEY) else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

APP_ORIGIN = os.getenv("APP_ORIGIN", "http://localhost:5173")
BOT_USERNAME = os.getenv("BOT_USERNAME", "")

# -----------------------------------------------------------------------------
# File storage layout (legacy/file mode)
# -----------------------------------------------------------------------------
ROOT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SESSIONS_DIR = os.path.join(ROOT_DIR, "sessions")
RESPONSES_DIR = os.path.join(ROOT_DIR, "responses")
os.makedirs(SESSIONS_DIR, exist_ok=True)
os.makedirs(RESPONSES_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _ensure_sb():
    if sb is None:
        raise HTTPException(status_code=500, detail="Supabase not configured")

def _canon_email(s: str | None) -> str:
    if not s: return ""
    return str(s).strip().lower()

# -----------------------------------------------------------------------------
# Models — Streamlit-parity (Supabase flow)
# -----------------------------------------------------------------------------
class FounderInputsStreamlit(BaseModel):
    # identity
    email: str
    founder_display_name: Optional[str] = None

    # core
    problem_domain: Optional[str] = None
    problems: List[str] = []                # stored as TEXT(JSON string) in founder_inputs
    value_prop: Optional[str] = None

    # pricing
    is_paid_service: bool = False
    pricing_model: Optional[str] = None
    pricing_model_considered: List[str] = []
    price_points: List[float] = []
    pricing_questions: List[str] = []

    # segments / audience
    segment_mode: Optional[str] = None
    target_segments: List[str] = []

    # actions (willingness)
    target_actions: List[str] = []

    # legacy (compat)
    target_audience: Optional[str] = None
    target_action: Optional[str] = None
    follow_up_action: Optional[str] = None

    # feedback
    founder_feedback: Optional[str] = None

class CreateSessionRespV2(BaseModel):
    session_id: str
    share_link: str

# -----------------------------------------------------------------------------
# Models — File-mode (legacy)
# -----------------------------------------------------------------------------
class FounderInputs(BaseModel):
    idea_summary: str
    target_user: str
    problems: List[str] = Field(..., min_items=1)
    value_prop: Optional[str] = None
    target_action: Optional[str] = None

class SessionCreate(BaseModel):
    founder_inputs: FounderInputs

class SessionCreateResp(BaseModel):
    session_id: str

class ResponsePayload(BaseModel):
    session_id: str
    respondent_id: str
    answers: dict
    meta: dict | None = None

# -----------------------------------------------------------------------------
# Health & Root
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "service": "verity-backend", "time": datetime.utcnow().isoformat()}

@app.get("/")
def root():
    return {"message": "Verity Backend is running. See /docs for API spec."}

# -----------------------------------------------------------------------------
# Founder register (optional)
# -----------------------------------------------------------------------------
class FounderRegister(BaseModel):
    email: str
    display_name: Optional[str] = None
@app.post("/founder/register")
def founder_register(req: FounderRegister):
    _ensure_sb()
    email = _canon_email(req.email)

    # Build the row. Do NOT send "id"; the DB will generate it.
    row = {
        "email": email,
        "display_name": (getattr(req, "display_name", None) or None),
        # If later you pass Supabase Auth user id, include it:
        # "user_id": getattr(req, "user_id", None)
    }

    # Upsert by email (requires unique constraint on email)
    sb.table("founders").upsert(row, on_conflict="email").execute()

    return {"ok": True}


# -----------------------------------------------------------------------------
# File-mode: create session (legacy) — unchanged
# -----------------------------------------------------------------------------
@app.post("/session", response_model=SessionCreateResp)
def create_session_file(payload: SessionCreate):
    sid = str(uuid.uuid4())
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(SESSIONS_DIR, f"{stamp}_{sid}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {"session_id": sid, "founder_inputs": payload.founder_inputs.model_dump(),
             "created_at_utc": datetime.utcnow().isoformat(), "version": "v0"},
            f, indent=2
        )
    return {"session_id": sid}

@app.post("/responses_file")
def store_response_file(payload: ResponsePayload):
    if not isinstance(payload.answers, dict) or not payload.answers:
        raise HTTPException(400, "answers must be a non-empty object")
    serialized = json.dumps(payload.model_dump(), sort_keys=True).encode("utf-8")
    digest = hashlib.sha256(serialized).hexdigest()
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    fname = f"{stamp}_{payload.session_id}_{payload.respondent_id}_{digest[:12]}.json"
    path = os.path.join(RESPONSES_DIR, fname)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {"received_at_utc": datetime.utcnow().isoformat(), "hash_sha256": digest,
             "payload": payload.model_dump(), "version": "v0"},
            f, indent=2
        )
    return {"ok": True, "hash": digest, "file": fname}

@app.post("/response")
def store_response_alias(payload: ResponsePayload):
    return store_response_file(payload)

# -----------------------------------------------------------------------------
# Script (legacy respond path) — unchanged
# -----------------------------------------------------------------------------
class StepType(str, Enum):
    text = "text"
    input_text = "input_text"
    input_scale = "input_scale"
    input_email = "input_email"

class Step(BaseModel):
    id: str
    type: StepType
    prompt: str
    next: Optional[str] = None
    min: Optional[int] = None
    max: Optional[int] = None
    required: bool = True

class Script(BaseModel):
    session_id: str
    domain: str
    value_prop: str
    target_action: str
    steps: List[Step]

def _load_session_founder_inputs(session_id: str) -> dict:
    pattern = os.path.join(SESSIONS_DIR, f"*_{session_id}.json")
    matches = sorted(glob.glob(pattern))
    if not matches:
        raise HTTPException(404, "session not found")
    with open(matches[0], "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("founder_inputs", {})

def _build_script(founder_inputs: dict, session_id: str) -> Script:
    domain = founder_inputs.get("problem_domain") or founder_inputs.get("idea_summary") or "this space"
    value_prop = founder_inputs.get("value_prop") or "a product that solves the problem"
    target_action = founder_inputs.get("target_action") or "sign up"
    steps: List[Step] = [
        Step(id="intro", type=StepType.text,
             prompt=("Hi! Thanks for taking the time.\n"
                     "This is early research for a new idea. Please be brutally honest — "
                     "your answers help the founder learn what's really going on.")),
        Step(id="context", type=StepType.input_text,
             prompt=(f'About "{domain}": what are you trying to achieve lately?\n'
                     "What have you tried? What emotions come up as you work on it?")),
        Step(id="resonance", type=StepType.input_scale,
             prompt=("On a scale of 1–5, how much does this resonate?\n"
                     "“I struggle to stay focused/productive through the day due to notifications, email, priorities.”"),
             min=1, max=5),
        Step(id="explanation", type=StepType.input_text, prompt="Why that score? Any situation or example come to mind?"),
        Step(id="action", type=StepType.input_text, prompt="Have you tried anything to tackle this? How did it go?"),
        Step(id="value_prop", type=StepType.input_text,
             prompt=(f'Value prop to react to:\n“{value_prop}”.\n'
                     f'If it delivered, how likely would you be to: {target_action}? Why?')),
        Step(id="price_test", type=StepType.input_text,
             prompt="If it worked as promised, what would you expect to pay? What feels fair vs expensive?"),
        Step(id="intent", type=StepType.input_email,
             prompt="Can we share your email with the founder for early access invites?"),
        Step(id="closing", type=StepType.text, prompt="That’s it — anything else we should understand? Thanks a ton 🙏"),
    ]
    return Script(session_id=session_id, domain=domain, value_prop=value_prop, target_action=target_action, steps=steps)

@app.get("/script", response_model=Script)
def get_script(session_id: str):
    if not session_id or not str(session_id).strip():
        raise HTTPException(400, "session_id is required")
    founder_inputs = _load_session_founder_inputs(session_id)
    return _build_script(founder_inputs, session_id=session_id)

# -----------------------------------------------------------------------------
# Hash endpoint
# -----------------------------------------------------------------------------
class HashRequest(BaseModel): text: str
class HashResponse(BaseModel): sha256: str; keccak: str

@app.post("/hash", response_model=HashResponse)
def hash_text(payload: HashRequest):
    txt = payload.text.strip()
    if not txt: raise HTTPException(400, "text cannot be empty")
    sha = hashlib.sha256(txt.encode("utf-8")).hexdigest()
    k = keccak.new(digest_bits=256); k.update(txt.encode("utf-8"))
    return HashResponse(sha256=sha, keccak=k.hexdigest())

# -----------------------------------------------------------------------------
# File-mode summary (legacy)
# -----------------------------------------------------------------------------
def _stamp_from_filename(path: str) -> str | None:
    name = os.path.basename(path)
    stamp = name.split("_", 1)[0]
    return stamp if len(stamp) == 16 and stamp.endswith("Z") else None

def _stamp_to_isoz(stamp: str) -> str:
    dt = datetime.strptime(stamp, "%Y%m%dT%H%M%SZ")
    return dt.isoformat() + "Z"

def _response_files_for_session(session_id: str) -> list[str]:
    pattern = os.path.join(RESPONSES_DIR, f"*_{session_id}_*.json")
    return sorted(glob.glob(pattern))

@app.get("/summary")
def get_summary_filemode(session_id: str):
    if not session_id or not str(session_id).strip():
        raise HTTPException(400, "session_id is required")
    files = _response_files_for_session(session_id)
    stamps = [s for s in (_stamp_from_filename(p) for p in files) if s]
    first_ts = _stamp_to_isoz(min(stamps)) if stamps else None
    last_ts  = _stamp_to_isoz(max(stamps)) if stamps else None
    return {"session_id": session_id, "responses_count": len(files), "first_ts": first_ts, "last_ts": last_ts}

# -----------------------------------------------------------------------------
# Supabase helpers
# -----------------------------------------------------------------------------
def _ensure_founder(email: str, display_name: str | None = None):
    _ensure_sb()
    email = _canon_email(email)
    row = {
        "email": email,
        "display_name": display_name or None,
    }
    # upsert by unique email
    sb.table("founders").upsert(row, on_conflict="email").execute()


def _upsert_founder_inputs(fi: FounderInputsStreamlit) -> str:
    _ensure_sb()
    founder_email = _canon_email(fi.email)
    sb.table("founder_inputs").upsert({
        "founder_email": founder_email,
        "founder_display_name": fi.founder_display_name,
        "problem_domain": fi.problem_domain,
        "target_audience": fi.target_audience,
        "problems": json.dumps(fi.problems),
        "value_prop": fi.value_prop,
        "is_paid_service": fi.is_paid_service,
        "pricing_model": fi.pricing_model,
        "pricing_model_considered": fi.pricing_model_considered,
        "price_points": fi.price_points,
        "pricing_questions": fi.pricing_questions,
        "segment_mode": fi.segment_mode,
        "target_segments": fi.target_segments,
        "target_action": fi.target_action,
        "follow_up_action": fi.follow_up_action,
        "target_actions": fi.target_actions,
        "founder_feedback": fi.founder_feedback,
    }, on_conflict="founder_email").execute()
    row = sb.table("founder_inputs").select("id").eq("founder_email", founder_email).single().execute()
    return row.data["id"]

# ---- New deterministic questionnaire (problem pages + pitch page) ------------
def _deterministic_steps(fi_row: dict) -> List[dict]:
    founder = fi_row.get("founder_display_name") or fi_row.get("founder_email") or "the founder"
    domain  = fi_row.get("problem_domain") or "this topic"
    value   = fi_row.get("value_prop") or "a product that solves this"

    problems = []
    try:
        raw = fi_row.get("problems")
        problems = raw if isinstance(raw, list) else json.loads(raw or "[]")
    except Exception:
        problems = []
    problems = [p for p in problems if isinstance(p, str) and p.strip()]

    is_paid = bool(fi_row.get("is_paid_service"))
    price_points = fi_row.get("price_points") or []
    if isinstance(price_points, str):
        try: price_points = json.loads(price_points or "[]")
        except Exception: price_points = []
    # Convert to float and filter out invalid values
    valid_price_points = []
    for p in price_points:
        try: 
            price = float(p)
            if price > 0:  # Only include positive prices
                valid_price_points.append(price)
        except Exception: pass

    segments = fi_row.get("target_segments") or []
    if isinstance(segments, str):
        try: segments = json.loads(segments or "[]")
        except Exception: segments = []
    segments = [s for s in segments if isinstance(s, str) and s.strip()]

    ACTION_LABELS = {
        "join_waitlist": "join the waitlist",
        "download_app": "download the app",
        "share_email": "share your email for updates",
        "follow_x": "follow on X",
    }
    target_actions = fi_row.get("target_actions") or []
    if isinstance(target_actions, str):
        try: target_actions = json.loads(target_actions or "[]")
        except Exception: target_actions = []
    primary_action_label = None
    for a in target_actions:
        if isinstance(a, str) and not a.startswith("other:"):
            primary_action_label = ACTION_LABELS.get(a, a.replace("_", " "))
            break
    if not primary_action_label:
        other = next((a for a in target_actions if isinstance(a, str) and a.startswith("other:")), None)
        if other: primary_action_label = other.split(":", 1)[1].strip()
    if not primary_action_label:
        primary_action_label = "take the next step"

    steps: List[dict] = [
        {"type": "account_setup", "key": "intro_a",
         "title": f"Hi! Thank you for taking the time to help {founder}.",
         "copy": "Sign in and connect your wallet for rewards (optional). Skip if you want to stay anonymous."},
        {"type": "text", "key": "intro_b",
         "label": ("This conversation is just between us — I'll analyse your insights alongside other "
                   f"responses before I share anonymous headlines with {founder}.")},
        {"type": "text", "key": "intro_c",
         "label": "This will shape how they spend the next months or even years and they need you to be completely honest, please.\nReady to go?"},
        {"type": "text", "key": "ctx_head",
         "label": f"{founder} is keen to talk to you about {domain}. Can you tell us a bit about your experience with it?"},
        {"type": "input_text", "key": "context", "label": "Tell us a bit about your experience."},
    ]

    if segments:
        steps.append({
            "type": "input_choice",
            "key": "segment",
            "label": "Which of these groups do you feel you most belong to?",
            "options": segments,
        })

    for idx, prob in enumerate(problems, start=1):
        steps.append({
            "type": "problem_block",
            "key": f"pb_{idx}",
            "problem": prob,
            "min": 1, "max": 5,
            "labels": {
                "scale": "How strongly do you relate to this? (1=no care, 5=HUGE problem)",
                "reason": "Can you tell me more about why you gave that score?",
                "attempts": "Have you ever taken any steps to try to tackle this? How did it go?",
            },
        })

    steps.append({
        "type": "scale_with_preamble",
        "key": "use_likelihood",
        "preamble": f"Here's what {founder} is thinking of spending the next few months building: {value}",
        "label": "If delivered, how likely would you be to use it regularly (1–5, not a friend bias)?",
        "min": 1, "max": 5,
    })

    steps += [
        {"type": "input_scale", "key": "willing_to_pay",
         "label": "On a scale of 1–5 how willing would you be to pay for it?", "min": 1, "max": 5},
    ]

    # Add specific price point questions for each price the founder specified
    if is_paid and valid_price_points:
        for idx, price in enumerate(valid_price_points, 1):
            steps.append({
                "type": "input_scale", 
                "key": f"willing_to_pay_price_{idx}",
                "label": f"On a scale of 1–5 how willing would you be to pay ${price:.2f}?",
                "min": 1, "max": 5
            })

    steps += [
        {"type": "input_text", "key": "price_fair",
         "label": "What would feel intuitively fair in terms of price?"},
        {"type": "input_text", "key": "anything_else",
         "label": f"Is there anything else you think {founder} should know but that you’d prefer they hear from me?"},
        {"type": "input_choice", "key": "cta_choice", 
         "label": f"Would you like to {primary_action_label} now?", 
         "options": ["Yes", "No", "Maybe later"]},
        {"type": "input_email", "key": "email", "label": "If you want updates, drop your email (optional)"},
        {"type": "text", "key": "closing", "label": "Thank you. We really appreciate your time and honesty. 🙏"},
    ]
    return steps

# -----------------------------------------------------------------------------
# Supabase: create session (Streamlit parity)
# -----------------------------------------------------------------------------
@app.post("/session_sb", response_model=CreateSessionRespV2)
def create_session_sb(payload: FounderInputsStreamlit):
    _ensure_sb()
    if not payload.email or "@" not in payload.email:
        raise HTTPException(400, "valid email is required")
    founder_email = _canon_email(payload.email)
    _ensure_founder(founder_email)

    # copy with canonicalized email
    fi_copy = payload.model_copy(update={"email": founder_email})
    fi_id = _upsert_founder_inputs(fi_copy)

    steps = _deterministic_steps(
        sb.table("founder_inputs").select("*").eq("id", fi_id).single().execute().data
    )
    ins = sb.table("sessions").insert({
        "founder_email": founder_email,
        "founder_inputs_id": fi_id,
        "questions": steps,
        "status": "active",
    }).execute()
    sid = ins.data[0]["id"]

    share_link = (f"https://t.me/{BOT_USERNAME}?startapp=sid_{sid}"
                  if BOT_USERNAME else f"{APP_ORIGIN}/respond?sid={sid}")
    return {"session_id": sid, "share_link": share_link}

# -----------------------------------------------------------------------------
# Supabase: fetch session questions
# -----------------------------------------------------------------------------
@app.get("/session_questions")
def session_questions(session_id: str):
    _ensure_sb()
    if not session_id: raise HTTPException(400, "session_id is required")
    row = sb.table("sessions").select("questions").eq("id", session_id).single().execute().data
    if not row: raise HTTPException(404, "session not found")
    return {"session_id": session_id, "steps": row["questions"]}

# -----------------------------------------------------------------------------
# Supabase: store responses with hashes
# -----------------------------------------------------------------------------
class SubmitAnswersReq(BaseModel):
    session_id: str
    tester_email: Optional[str] = None
    tester_handle: Optional[str] = None
    answers: dict

@app.post("/responses_sb")
def submit_responses_sb(req: SubmitAnswersReq):
    _ensure_sb()
    if not isinstance(req.answers, dict) or not req.answers:
        raise HTTPException(400, "answers must be a non-empty object")

    sess = sb.table("sessions").select("id, founder_email").eq("id", req.session_id).single().execute().data
    if not sess: raise HTTPException(404, "Session not found")

    # tester upsert
    if req.tester_email and "@" in req.tester_email:
        email = _canon_email(req.tester_email)
        # upsert by email (requires testers.email UNIQUE)
        sb.table("testers").upsert(
            {"email": email, "telegram_handle": req.tester_handle},
            on_conflict="email",
        ).execute()
        tester_row = (
            sb.table("testers").select("id").eq("email", email).single().execute().data
        )
        tester_id = tester_row["id"]
    else:
        # make a unique anon email
        anon = f"anon_{int(datetime.utcnow().timestamp())}@tg.local"
        t = sb.table("testers").insert(
            {"email": anon, "telegram_handle": req.tester_handle}
        ).execute()
        tester_id = t.data[0]["id"]

    payload_str = json.dumps(req.answers, sort_keys=True, ensure_ascii=False)
    sha = hashlib.sha256(payload_str.encode()).hexdigest()
    try:
        k = keccak.new(digest_bits=256); k.update(payload_str.encode()); keccak_hex = k.hexdigest()
    except Exception:
        keccak_hex = sha

    sb.table("responses").insert({
        "session_id": req.session_id,
        "tester_id": tester_id,         # when available
        "tester_email": req.tester_email,   # optional fallback
        "founder_email": sess["founder_email"],
        "answers": req.answers,
        "answer_hash": keccak_hex,
        "payment_amount": 0,
        "paid": False
    }).execute()

    return {"ok": True, "hashes": {"sha256": sha, "keccak": keccak_hex}}

# -----------------------------------------------------------------------------
# Supabase: summary, founder_sessions, per-session responses
# -----------------------------------------------------------------------------
@app.get("/summary_sb")
def summary_sb(session_id: str):
    _ensure_sb()
    rows = (sb.table("responses").select("created_at").eq("session_id", session_id).order("created_at", desc=False).execute().data) or []
    count = len(rows)
    first_ts = rows[0]["created_at"] if count else None
    last_ts  = rows[-1]["created_at"] if count else None
    return {"session_id": session_id, "responses_count": count, "first_ts": first_ts, "last_ts": last_ts}

@app.get("/founder_sessions")
def founder_sessions(founder_email: str):
    _ensure_sb()
    founder_email = _canon_email(founder_email)
    sess: List[Dict[str, Any]] = (
        sb.table("sessions").select("id, created_at, status").eq("founder_email", founder_email)
        .order("created_at", desc=True).execute().data or []
    )
    if not sess: return {"sessions": []}

    ids = [s["id"] for s in sess]
    resp_rows: List[Dict[str, Any]] = (
        sb.table("responses").select("session_id, created_at").in_("session_id", ids)
        .order("created_at", desc=True).execute().data or []
    )

    counts: Dict[str, Dict[str, Any]] = {}
    for sid in ids:
        r = [x for x in resp_rows if x["session_id"] == sid]
        counts[sid] = {"count": len(r), "last_ts": r[0]["created_at"] if r else None}

    for s in sess:
        m = counts.get(s["id"], {"count": 0, "last_ts": None})
        s["responses_count"] = m["count"]
        s["last_response_at"] = m["last_ts"]

    return {"sessions": sess}

@app.get("/session_responses")
def session_responses(session_id: str, include_answers: bool = False, tester_email: str | None = None):
    _ensure_sb()
    if not session_id: raise HTTPException(400, "session_id is required")

    tester_id_filter = None
    if tester_email:
        t = sb.table("testers").select("id").eq("email", _canon_email(tester_email)).single().execute().data
        if not t: return {"session_id": session_id, "responses": []}
        tester_id_filter = t["id"]

    cols = "id, tester_id, answer_hash, created_at, answers"
    resp_q = sb.table("responses").select(cols).eq("session_id", session_id)
    if tester_id_filter: resp_q = resp_q.eq("tester_id", tester_id_filter)

    resp_rows = resp_q.order("created_at", desc=True).execute().data or []
    if not resp_rows: return {"session_id": session_id, "responses": []}

    tester_ids = sorted({r["tester_id"] for r in resp_rows if r.get("tester_id")})
    tmap: Dict[str, Dict[str, str | None]] = {}
    if tester_ids:
        trows = sb.table("testers").select("id, email, telegram_handle").in_("id", tester_ids).execute().data or []
        tmap = {t["id"]: {"email": t["email"], "handle": t.get("telegram_handle")} for t in trows}

    out: List[Dict] = []
    for r in resp_rows:
        ans = r.get("answers") or {}
        preview_parts = []
        for k, v in list(ans.items())[:3]:
            s = str(v); preview_parts.append(f"{k}={s[:40]}{'…' if len(s) > 40 else ''}")
        ti = tmap.get(r.get("tester_id"), {})
        out.append({
            "id": r["id"],
            "created_at": r["created_at"],
            "answer_hash": r["answer_hash"],
            "tester_email": ti.get("email"),
            "tester_handle": ti.get("handle"),
            "preview": ", ".join(preview_parts),
            "answers": (ans if include_answers else None),
        })
    return {"session_id": session_id, "responses": out}

@app.get("/tester_questionnaires")
def tester_questionnaires(uid: str | None = None, tester_email: str | None = None):
    _ensure_sb()
    
    # Get all active sessions with founder details
    sessions = (sb.table("sessions")
                .select("*, founder_inputs!inner(*)")
                .eq("status", "active")
                .order("created_at", desc=True)
                .execute().data)
    
    # Get tester's responses with answers to calculate completion percentage and payment info
    tester_responses = []
    if uid:  # supabase auth uid
        tester_responses = (sb.table("responses")
                           .select("session_id, created_at, answers, payment_amount, paid")
                           .eq("tester_id", uid)
                           .execute().data)
    elif tester_email:
        tester_responses = (sb.table("responses")
                           .select("session_id, created_at, answers, payment_amount, paid")
                           .eq("tester_email", tester_email.lower())
                           .execute().data)
    
    # Create a set of completed session IDs and calculate completion percentages
    completed_sessions = {r["session_id"] for r in tester_responses}
    
    # Format the questionnaires
    questionnaires = []
    for session in sessions:
        founder_data = session.get("founder_inputs", {})
        session_id = session["id"]
        questions = session.get("questions", [])
        total_questions = len(questions)
        
        # Find the latest response for this session by this tester
        latest_response = None
        completion_percentage = 0
        payment_amount = 0
        paid = False
        
        for resp in tester_responses:
            if resp["session_id"] == session_id:
                if not latest_response or resp["created_at"] > latest_response["created_at"]:
                    latest_response = resp
                    
                    # Calculate completion percentage based on answered questions
                    if resp.get("answers") and total_questions > 0:
                        answered_questions = 0
                        answerable_questions = 0
                        answers = resp.get("answers", {})
                        
                        # Debug: print answers for troubleshooting
                        print(f"DEBUG: Session {session_id}, Answers: {answers}")
                        print(f"DEBUG: Total questions: {total_questions}")
                        
                        for question in questions:
                            question_type = question.get("type", "")
                            question_key = question.get("key")
                            
                            # Only count questions that require answers (exclude text, account_setup, input_email)
                            # All other types are required: input_text, input_scale, input_choice, problem_block, scale_with_preamble
                            if question_type not in ["text", "account_setup", "input_email"]:
                                answerable_questions += 1
                                print(f"DEBUG: Answerable question - Type: {question_type}, Key: {question_key}")
                                
                                if question_key and question_key in answers:
                                    # Consider any non-None answer as answered
                                    answer_value = answers[question_key]
                                    print(f"DEBUG: Found answer for {question_key}: {answer_value}")
                                    if answer_value is not None:
                                        answered_questions += 1
                                        print(f"DEBUG: Counted as answered: {question_key}")
                                else:
                                    print(f"DEBUG: No answer found for {question_key}")
                        
                        print(f"DEBUG: Answered: {answered_questions}, Answerable: {answerable_questions}")
                        if answerable_questions > 0:
                            completion_percentage = min(100, int((answered_questions / answerable_questions) * 100))
                        else:
                            completion_percentage = 0
                        print(f"DEBUG: Final completion percentage: {completion_percentage}%")
                    
                    # Get payment information
                    payment_amount = resp.get("payment_amount", 0)
                    paid = resp.get("paid", False)
        
        questionnaires.append({
            "session_id": session_id,
            "company_name": founder_data.get("founder_display_name") or founder_data.get("founder_email") or "Unknown Company",
            "founder_email": session.get("founder_email", ""),
            "problem_domain": founder_data.get("problem_domain") or "General",
            "value_prop": founder_data.get("value_prop", ""),
            "created_at": session["created_at"],
            "is_completed": session_id in completed_sessions,
            "completion_percentage": completion_percentage,
            "total_questions": total_questions,
            "payment_amount": payment_amount,
            "paid": paid,
            "last_response_at": latest_response["created_at"] if latest_response else None,
            "share_link": f"{APP_ORIGIN}/respond?sid={session_id}"
        })
    
    return {"questionnaires": questionnaires}

@app.get("/tester_responses")
def tester_responses(uid: str | None = None, tester_email: str | None = None):
    _ensure_sb()
    
    # Get responses with session and founder details
    if uid:  # supabase auth uid
        # Join responses with sessions and founder_inputs to get company details
        rows = (sb.table("responses")
                .select("*, sessions!inner(*, founder_inputs!inner(*))")
                .eq("tester_id", uid)
                .order("created_at", desc=True)
                .execute().data)
    elif tester_email:
        # fallback by email
        rows = (sb.table("responses")
                .select("*, sessions!inner(*, founder_inputs!inner(*))")
                .eq("tester_email", tester_email.lower())
                .order("created_at", desc=True)
                .execute().data)
    else:
        rows = []
    
    # Format the response data
    formatted_responses = []
    for row in rows:
        session_data = row.get("sessions", {})
        founder_data = session_data.get("founder_inputs", {})
        
        formatted_responses.append({
            "id": row["id"],
            "session_id": row["session_id"],
            "created_at": row["created_at"],
            "answer_hash": row["answer_hash"],
            "answers": row["answers"],
            "founder_email": row["founder_email"],
            "company_name": founder_data.get("founder_display_name") or founder_data.get("founder_email") or "Unknown Company",
            "problem_domain": founder_data.get("problem_domain") or "General",
            "session_status": session_data.get("status", "unknown"),
            "payment_amount": row.get("payment_amount", 0),
            "paid": row.get("paid", False)
        })
    
    return {"responses": formatted_responses}

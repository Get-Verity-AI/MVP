from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
import hashlib, json, os, uuid
from enum import Enum
from typing import List, Optional, Dict, Any
import glob
from fastapi.middleware.cors import CORSMiddleware
from Crypto.Hash import keccak
from supabase import create_client, Client
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# App & CORS
# -----------------------------------------------------------------------------
app = FastAPI(title="Verity Backend", version="0.2.0")

load_dotenv()
SB_URL = os.getenv("SUPABASE_URL")
SB_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
sb: Client | None = create_client(SB_URL, SB_KEY) if (SB_URL and SB_KEY) else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),  # e.g. http://localhost:5173
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# -----------------------------------------------------------------------------
# File storage layout (legacy/file mode)
# -----------------------------------------------------------------------------
ROOT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SESSIONS_DIR = os.path.join(ROOT_DIR, "sessions")
RESPONSES_DIR = os.path.join(ROOT_DIR, "responses")
os.makedirs(SESSIONS_DIR, exist_ok=True)
os.makedirs(RESPONSES_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# Models — Streamlit-parity (Supabase flow)
# -----------------------------------------------------------------------------
class FounderInputsStreamlit(BaseModel):
    class FounderInputsStreamlit(BaseModel):
    # identity
    email: str
    founder_display_name: Optional[str] = None

    # core
    problem_domain: Optional[str] = None
    problems: List[str] = []                # TEXT column in DB (JSON string)
    value_prop: Optional[str] = None

    # pricing
    is_paid_service: bool = False
    pricing_model: Optional[str] = None
    pricing_model_considered: List[str] = []  # jsonb
    price_points: List[float] = []            # jsonb
    pricing_questions: List[str] = []         # jsonb (optional keep)

    # segments / audience
    segment_mode: Optional[str] = None        # 'one' | 'decide'
    target_segments: List[str] = []           # jsonb

    # actions (willingness)
    target_actions: List[str] = []            # jsonb

    # legacy fields left for compat (optional)
    target_audience: Optional[str] = None
    target_action: Optional[str] = None
    follow_up_action: Optional[str] = None

    # feedback
    founder_feedback: Optional[str] = None

class CreateSessionRespV2(BaseModel):
    session_id: str
    share_link: str

# -----------------------------------------------------------------------------
# Models — File-mode (legacy) to keep your existing miniapp working
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
    session_id: str = Field(..., description="Interview/session id")
    respondent_id: str = Field(..., description="Unique respondent id (or email hash)")
    answers: dict = Field(..., description="Arbitrary answer map")
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

# --------------------------------------------------------------------
# founder register endpoint
# --------------------------------------------------------------------

class FounderRegister(BaseModel):
    email: str
    display_name: Optional[str] = None

@app.post("/founder/register")
def founder_register(req: FounderRegister):
    _ensure_sb()
    sb.table("founders").upsert(
        {
            "email": req.email,
            "display_name": req.display_name or None,
            "password_hash": "telegram",  # placeholder
        },
        on_conflict="email",
    ).execute()
    return {"ok": True}


# -----------------------------------------------------------------------------
# File-mode: create session (legacy)
# -----------------------------------------------------------------------------
@app.post("/session", response_model=SessionCreateResp)
def create_session_file(payload: SessionCreate):
    sid = str(uuid.uuid4())
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(SESSIONS_DIR, f"{stamp}_{sid}.json")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "session_id": sid,
                "founder_inputs": payload.founder_inputs.model_dump(),
                "created_at_utc": datetime.utcnow().isoformat(),
                "version": "v0",
            },
            f,
            indent=2,
        )
    return {"session_id": sid}

# -----------------------------------------------------------------------------
# File-mode: store responses (legacy)
# -----------------------------------------------------------------------------
@app.post("/responses_file")
def store_response_file(payload: ResponsePayload):
    # Validate answers is a non-empty JSON object
    if not isinstance(payload.answers, dict) or not payload.answers:
        raise HTTPException(status_code=400, detail="answers must be a non-empty object")

    # Serialize with sorted keys → stable hash
    serialized = json.dumps(payload.model_dump(), sort_keys=True).encode("utf-8")
    digest = hashlib.sha256(serialized).hexdigest()
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    fname = f"{stamp}_{payload.session_id}_{payload.respondent_id}_{digest[:12]}.json"
    path = os.path.join(RESPONSES_DIR, fname)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "received_at_utc": datetime.utcnow().isoformat(),
                "hash_sha256": digest,
                "payload": payload.model_dump(),
                "version": "v0",
            },
            f,
            indent=2,
        )

    return {"ok": True, "hash": digest, "file": fname}

# Keep the old alias pointing to file-mode for backward compatibility
@app.post("/response")
def store_response_alias(payload: ResponsePayload):
    return store_response_file(payload)

# -----------------------------------------------------------------------------
# Script models & file-mode script generator (used by /script)
# -----------------------------------------------------------------------------
class StepType(str, Enum):
    text = "text"            # read-only message
    input_text = "input_text"
    input_scale = "input_scale"
    input_email = "input_email"

class Step(BaseModel):
    id: str
    type: StepType
    prompt: str
    next: Optional[str] = None
    min: Optional[int] = None     # only for input_scale
    max: Optional[int] = None
    required: bool = True

class Script(BaseModel):
    session_id: str
    domain: str
    value_prop: str
    target_action: str
    steps: List[Step]

def _load_session_founder_inputs(session_id: str) -> dict:
    """
    Finds the first session file matching *_<session_id>.json under SESSIONS_DIR
    and returns founder_inputs dict. Raises HTTPException(404) if not found.
    """
    pattern = os.path.join(SESSIONS_DIR, f"*_{session_id}.json")
    matches = sorted(glob.glob(pattern))
    if not matches:
        raise HTTPException(status_code=404, detail="session not found")
    with open(matches[0], "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("founder_inputs", {})

def _build_script(founder_inputs: dict, session_id: str) -> Script:
    domain = founder_inputs.get("problem_domain") or founder_inputs.get("idea_summary") or "this space"
    value_prop = founder_inputs.get("value_prop") or "a product that solves the problem"
    target_action = founder_inputs.get("target_action") or "sign up"

    steps: List[Step] = [
        Step(
            id="intro",
            type=StepType.text,
            prompt=(
                "Hi! Thanks for taking the time.\n"
                "This is early research for a new idea. Please be brutally honest — "
                "your answers help the founder learn what's really going on."
            ),
            next="context",
            required=False,
        ),
        Step(
            id="context",
            type=StepType.input_text,
            prompt=(
                f'About "{domain}": what are you trying to achieve lately?\n'
                "What have you tried? What emotions come up as you work on it?"
            ),
            next="problem_intro",
        ),
        Step(
            id="problem_intro",
            type=StepType.text,
            prompt="Thanks! Let’s zoom into a specific problem area the founder is exploring.",
            next="resonance",
            required=False,
        ),
        Step(
            id="resonance",
            type=StepType.input_scale,
            prompt=(
                "On a scale of 1–5, how much does this resonate?\n"
                '“I struggle to stay focused/productive through the day due to notifications, email, priorities.”'
            ),
            min=1, max=5, next="explanation",
        ),
        Step(
            id="explanation",
            type=StepType.input_text,
            prompt="Why that score? Any situation or example come to mind?",
            next="action",
        ),
        Step(
            id="action",
            type=StepType.input_text,
            prompt="Have you tried anything to tackle this? How did it go?",
            next="value_prop",
        ),
        Step(
            id="value_prop",
            type=StepType.input_text,
            prompt=(
                f'Value prop to react to:\n“{value_prop}”.\n'
                f'If it delivered, how likely would you be to: {target_action}? Why?'
            ),
            next="price_test",
        ),
        Step(
            id="price_test",
            type=StepType.input_text,
            prompt="If it worked as promised, what would you expect to pay? What feels fair vs expensive?",
            next="intent",
        ),
        Step(
            id="intent",
            type=StepType.input_email,
            prompt="Can we share your email with the founder for early access invites?",
            next="closing",
        ),
        Step(
            id="closing",
            type=StepType.text,
            prompt="That’s it — anything else we should understand? Thanks a ton 🙏",
            next=None,
            required=False,
        ),
    ]

    return Script(
        session_id=session_id,
        domain=domain,
        value_prop=value_prop,
        target_action=target_action,
        steps=steps,
    )

@app.get("/script", response_model=Script)
def get_script(session_id: str):
    if not session_id or not str(session_id).strip():
        raise HTTPException(status_code=400, detail="session_id is required")
    founder_inputs = _load_session_founder_inputs(session_id)
    return _build_script(founder_inputs, session_id=session_id)

# -----------------------------------------------------------------------------
# Hash endpoint
# -----------------------------------------------------------------------------
class HashRequest(BaseModel):
    text: str

class HashResponse(BaseModel):
    sha256: str
    keccak: str

@app.post("/hash", response_model=HashResponse)
def hash_text(payload: HashRequest):
    txt = payload.text.strip()
    if not txt:
        raise HTTPException(status_code=400, detail="text cannot be empty")

    sha = hashlib.sha256(txt.encode("utf-8")).hexdigest()
    k = keccak.new(digest_bits=256)
    k.update(txt.encode("utf-8"))
    keccak_digest = k.hexdigest()

    return HashResponse(sha256=sha, keccak=keccak_digest)

# -----------------------------------------------------------------------------
# File-mode summary (legacy)
# -----------------------------------------------------------------------------
def _stamp_from_filename(path: str) -> str | None:
    """Extract leading YYYYMMDDTHHMMSSZ from a response filename."""
    name = os.path.basename(path)
    stamp = name.split("_", 1)[0]
    return stamp if len(stamp) == 16 and stamp.endswith("Z") else None

def _stamp_to_isoz(stamp: str) -> str:
    """Convert YYYYMMDDTHHMMSSZ -> ISO8601 + 'Z' suffix."""
    dt = datetime.strptime(stamp, "%Y%m%dT%H%M%SZ")
    return dt.isoformat() + "Z"

def _response_files_for_session(session_id: str) -> list[str]:
    """Return list of response JSON file paths for a given session_id."""
    pattern = os.path.join(RESPONSES_DIR, f"*_{session_id}_*.json")
    return sorted(glob.glob(pattern))

@app.get("/summary")
def get_summary_filemode(session_id: str):
    if not session_id or not str(session_id).strip():
        raise HTTPException(status_code=400, detail="session_id is required")
    files = _response_files_for_session(session_id)
    stamps = [s for s in (_stamp_from_filename(p) for p in files) if s]
    first_ts = _stamp_to_isoz(min(stamps)) if stamps else None
    last_ts  = _stamp_to_isoz(max(stamps)) if stamps else None
    return {
        "session_id": session_id,
        "responses_count": len(files),
        "first_ts": first_ts,
        "last_ts": last_ts,
    }

# -----------------------------------------------------------------------------
# Supabase helpers
# -----------------------------------------------------------------------------
def _ensure_sb():
    if sb is None:
        raise HTTPException(status_code=500, detail="Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend .env")

def _ensure_founder(email: str):
    _ensure_sb()
    sb.table("founders").upsert(
        {"email": email, "password_hash": "telegram"},  # placeholder to satisfy schema
        on_conflict="email",
    ).execute()

def _upsert_founder_inputs(fi: FounderInputsStreamlit) -> str:
    _ensure_sb()
    sb.table("founder_inputs").upsert({
        "founder_email": fi.email,
        "founder_display_name": fi.founder_display_name,
        "problem_domain": fi.problem_domain,
        "target_audience": fi.target_audience,  # keep for compat
        "problems": json.dumps(fi.problems),    # TEXT column (JSON string)
        "value_prop": fi.value_prop,

        # pricing
        "is_paid_service": fi.is_paid_service,
        "pricing_model": fi.pricing_model,
        "pricing_model_considered": fi.pricing_model_considered,
        "price_points": fi.price_points,
        "pricing_questions": fi.pricing_questions,

        # segments
        "segment_mode": fi.segment_mode,
        "target_segments": fi.target_segments,

        # actions
        "target_action": fi.target_action,
        "follow_up_action": fi.follow_up_action,
        "target_actions": fi.target_actions,

        # feedback
        "founder_feedback": fi.founder_feedback,
    }, on_conflict="founder_email").execute()

    row = sb.table("founder_inputs").select("id").eq("founder_email", fi.email).single().execute()
    return row.data["id"]


def _deterministic_steps(fi_row: dict) -> List[dict]:
    problems = []
    try:
        problems = json.loads(fi_row.get("problems") or "[]")
    except Exception:
        pass

    steps: List[dict] = [
        {"type": "text", "key": "intro", "label": f"Quick chat about {fi_row.get('problem_domain') or 'your workflow'}"},
        {"type": "input_text", "key": "context", "label": "Tell us about a recent time this came up."},
    ]
    if problems:
        steps += [{"type": "text", "key": f"p{i}_head", "label": f"Problem: {p}"} for i, p in enumerate(problems, 1)]
        steps += [{"type": "input_scale", "key": "resonance", "label": "How much does this resonate? (1-5)", "min": 1, "max": 5}]
        steps += [{"type": "input_text", "key": "explain", "label": "Can you share a concrete example?"}]
    steps += [
        {"type": "text", "key": "pitch", "label": fi_row.get("value_prop") or "Proposed solution"},
        {"type": "input_text", "key": "action_react", "label": f"Would you {fi_row.get('target_action') or 'try it'}? Why/why not?"},
        {"type": "input_email", "key": "email", "label": "If you want updates, drop your email"},
    ]
    return steps

def _build_questions(founder_inputs_id: str) -> List[dict]:
    _ensure_sb()
    fi = sb.table("founder_inputs").select("*").eq("id", founder_inputs_id).single().execute().data
    # Swap with LLM if/when desired
    return _deterministic_steps(fi)

# -----------------------------------------------------------------------------
# Supabase: create session (Streamlit parity)
# -----------------------------------------------------------------------------
@app.post("/session_sb", response_model=CreateSessionRespV2)
def create_session_sb(payload: FounderInputsStreamlit):
    """
    - Upsert founders + founder_inputs (by founder_email unique)
    - Generate questions (deterministic for now)
    - Insert into sessions with questions json
    - Return { session_id, share_link }
    """
    _ensure_sb()
    if not payload.email or "@" not in payload.email:
        raise HTTPException(400, "valid email is required")

    _ensure_founder(payload.email)
    fi_id = _upsert_founder_inputs(payload)
    steps = _build_questions(fi_id)

    ins = sb.table("sessions").insert({
        "founder_email": payload.email,
        "founder_inputs_id": fi_id,
        "questions": steps,
        "status": "active",
    }).execute()
    sid = ins.data[0]["id"]

    bot = os.getenv("BOT_USERNAME", "")
    origin = os.getenv("APP_ORIGIN", "")
    share_link = f"https://t.me/{bot}?startapp=sid_{sid}" if bot else f"{origin}/respond?sid={sid}"

    return {"session_id": sid, "share_link": share_link}

# -----------------------------------------------------------------------------
# Supabase: fetch session questions (respondent UI)
# -----------------------------------------------------------------------------
@app.get("/session_questions")
def session_questions(session_id: str):
    _ensure_sb()
    if not session_id:
        raise HTTPException(400, "session_id is required")
    row = sb.table("sessions").select("questions").eq("id", session_id).single().execute().data
    if not row:
        raise HTTPException(404, "session not found")
    return {"session_id": session_id, "steps": row["questions"]}

# -----------------------------------------------------------------------------
# Supabase: store responses with hashes
# -----------------------------------------------------------------------------
class SubmitAnswersReq(BaseModel):
    session_id: str
    tester_email: Optional[str] = None
    tester_handle: Optional[str] = None  # NEW: telegram handle like @alice
    answers: dict

@app.post("/responses_sb")
def submit_responses_sb(req: SubmitAnswersReq):
    _ensure_sb()
    if not isinstance(req.answers, dict) or not req.answers:
        raise HTTPException(400, detail="answers must be a non-empty object")

    sess = sb.table("sessions").select("id, founder_email").eq("id", req.session_id).single().execute().data
    if not sess:
        raise HTTPException(404, "Session not found")

    # Tester upsert (email or anonymous surrogate)
    if req.tester_email and "@" in req.tester_email:
        # upsert by email; update telegram_handle if provided
        sb.table("testers").upsert(
            {
                "email": req.tester_email,
                "password_hash": "telegram",
                "telegram_handle": req.tester_handle,
            },
            on_conflict="email",
        ).execute()
        tester_row = (
            sb.table("testers")
            .select("id")
            .eq("email", req.tester_email)
            .single()
            .execute()
            .data
        )
        tester_id = tester_row["id"]
    else:
        anon = f"anon_{datetime.utcnow().timestamp()}@tg.local"
        t = sb.table("testers").insert(
            {
                "email": anon,
                "password_hash": "telegram",
                "telegram_handle": req.tester_handle,
            }
        ).execute()
        tester_id = t.data[0]["id"]

    payload_str = json.dumps(req.answers, sort_keys=True, ensure_ascii=False)
    sha = hashlib.sha256(payload_str.encode()).hexdigest()
    try:
        k = keccak.new(digest_bits=256)
        k.update(payload_str.encode())
        keccak_hex = k.hexdigest()
    except Exception:
        keccak_hex = sha  # fallback

    sb.table("responses").insert({
        "session_id": req.session_id,
        "tester_id": tester_id,
        "founder_email": sess["founder_email"],
        "answers": req.answers,
        "answer_hash": keccak_hex,
        "payment_amount": 0,
        "paid": False
    }).execute()

    return {"ok": True, "hashes": {"sha256": sha, "keccak": keccak_hex}}

# -----------------------------------------------------------------------------
# Supabase: summary
# -----------------------------------------------------------------------------
@app.get("/summary_sb")
def summary_sb(session_id: str):
    _ensure_sb()
    rows = (
        sb.table("responses")
        .select("created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=False)   # explicit ordering
        .execute()
        .data
    )
    if rows is None:
        raise HTTPException(404, "session not found or no responses yet")
    count = len(rows)
    first_ts = rows[0]["created_at"] if count else None
    last_ts  = rows[-1]["created_at"] if count else None
    return {"session_id": session_id, "responses_count": count, "first_ts": first_ts, "last_ts": last_ts}

# -----------------------------------------------------------------------------
# Founders dashbord
# -----------------------------------------------------------------------------

from typing import List, Dict

@app.get("/founder_sessions")
def founder_sessions(founder_email: str):
    _ensure_sb()
    sess: List[Dict[str, Any]] = (
        sb.table("sessions")
          .select("id, created_at, status")
          .eq("founder_email", founder_email)
          .order("created_at", desc=True)
          .execute()
          .data
        or []
    )

    if not sess:
        return {"sessions": []}

    ids = [s["id"] for s in sess]
    resp_rows: List[Dict[str, Any]] = (
        sb.table("responses")
          .select("session_id, created_at")
          .in_("session_id", ids)
          .order("created_at", desc=True)
          .execute()
          .data
        or []
    )

    counts: Dict[str, Dict[str, Any]] = {}
    for sid in ids:
        r = [x for x in resp_rows if x["session_id"] == sid]
        counts[sid] = {
            "count": len(r),
            "last_ts": r[0]["created_at"] if r else None
        }

    for s in sess:
        m = counts.get(s["id"], {"count": 0, "last_ts": None})
        s["responses_count"] = m["count"]
        s["last_response_at"] = m["last_ts"]

    return {"sessions": sess}

# ----------------------------------------------------------------------------- 
# Supabase: per-session responses (for founder dashboard)
# -----------------------------------------------------------------------------
from typing import Dict
from typing import Dict, List

@app.get("/session_responses")
def session_responses(
    session_id: str,
    include_answers: bool = False,
    tester_email: str | None = None,
):
    _ensure_sb()
    if not session_id:
        raise HTTPException(400, "session_id is required")

    tester_id_filter = None
    if tester_email:
        t = (
            sb.table("testers")
            .select("id")
            .eq("email", tester_email)
            .single()
            .execute()
            .data
        )
        if not t:
            return {"session_id": session_id, "responses": []}
        tester_id_filter = t["id"]

    cols = "id, tester_id, answer_hash, created_at, answers"
    resp_q = sb.table("responses").select(cols).eq("session_id", session_id)
    if tester_id_filter:
        resp_q = resp_q.eq("tester_id", tester_id_filter)

    resp_rows = resp_q.order("created_at", desc=True).execute().data or []

    if not resp_rows:
        return {"session_id": session_id, "responses": []}

    tester_ids = sorted({r["tester_id"] for r in resp_rows if r.get("tester_id")})
    tmap: Dict[str, Dict[str, str | None]] = {}
    if tester_ids:
        trows = (
            sb.table("testers")
            .select("id, email, telegram_handle")
            .in_("id", tester_ids)
            .execute()
            .data or []
        )
        tmap = {t["id"]: {"email": t["email"], "handle": t.get("telegram_handle")} for t in trows}

    out: List[Dict] = []
    for r in resp_rows:
        ans = r.get("answers") or {}
        # make a short preview from first 3 keys
        preview_parts = []
        for k, v in list(ans.items())[:3]:
            s = str(v)
            preview_parts.append(f"{k}={s[:40]}{'…' if len(s) > 40 else ''}")
        preview = ", ".join(preview_parts)

        ti = tmap.get(r.get("tester_id"), {})
        out.append({
            "id": r["id"],
            "created_at": r["created_at"],
            "answer_hash": r["answer_hash"],
            "tester_email": ti.get("email"),
            "tester_handle": ti.get("handle"),
            "preview": preview,
            "answers": (ans if include_answers else None),
        })

    return {"session_id": session_id, "responses": out}

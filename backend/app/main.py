from typing import Any, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
import hashlib, json, os, uuid
from enum import Enum
from typing import List, Optional
import glob


app = FastAPI(title="Verity Backend", version="0.2.0")


# --- storage layout ---------------------------------------------------------
ROOT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SESSIONS_DIR = os.path.join(ROOT_DIR, "sessions")
RESPONSES_DIR = os.path.join(ROOT_DIR, "responses")
os.makedirs(SESSIONS_DIR, exist_ok=True)
os.makedirs(RESPONSES_DIR, exist_ok=True)

# --- schemas ----------------------------------------------------------------
class FounderInputs(BaseModel):
    # keep this minimal for MVP; expand later
    idea_summary: str
    target_user: str
    problems: list[str] = Field(..., min_items=1)
    value_prop: str | None = None
    target_action: str | None = None

class SessionCreate(BaseModel):
    founder_inputs: FounderInputs

class SessionCreateResp(BaseModel):
    session_id: str

class ResponsePayload(BaseModel):
    session_id: str = Field(..., description="Interview/session id")
    respondent_id: str = Field(..., description="Unique respondent id (or email hash)")
    answers: dict = Field(..., description="Arbitrary answer map")
    meta: dict | None = None

# --- health -----------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "service": "verity-backend", "time": datetime.utcnow().isoformat()}

# --- root -------------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Verity Backend is running. See /docs for API spec."}

# --- sessions ---------------------------------------------------------------
@app.post("/session", response_model=SessionCreateResp)
def create_session(payload: SessionCreate):
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

# --- responses --------------------------------------------------------------
@app.post("/responses")
def store_response(payload: ResponsePayload):
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
# --- alias (singular) -------------------------------------------------------

@app.post("/response")
def store_response_alias(payload: ResponsePayload):
    """Backward-compat alias for /responses."""
    return store_response(payload)
# ---------- SCRIPT MODELS ----------
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
# ---------- /script ENDPOINT ----------
@app.get("/script", response_model=Script)
def get_script(session_id: str):
    if not session_id or not str(session_id).strip():
        raise HTTPException(status_code=400, detail="session_id is required")
    founder_inputs = _load_session_founder_inputs(session_id)
    return _build_script(founder_inputs, session_id=session_id)


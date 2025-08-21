from fastapi import FastAPI
from pydantic import BaseModel, Field
from datetime import datetime
import hashlib, json, os, uuid

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

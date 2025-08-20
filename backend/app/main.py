from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
import hashlib, json, os, uuid

app = FastAPI(title="Verity Backend", version="0.1.0")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

class ResponsePayload(BaseModel):
    session_id: str = Field(..., description="Interview/session id")
    respondent_id: str = Field(..., description="Unique respondent id (or email hash)")
    answers: dict = Field(..., description="Arbitrary answer map")
    meta: dict | None = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "verity-backend", "time": datetime.utcnow().isoformat()}

@app.post("/responses")
def store_response(payload: ResponsePayload):
    # Serialize with sorted keys for stable hash
    serialized = json.dumps(payload.model_dump(), sort_keys=True).encode("utf-8")
    digest = hashlib.sha256(serialized).hexdigest()
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    fname = f"{stamp}_{payload.session_id}_{payload.respondent_id}_{digest[:12]}.json"

    path = os.path.join(DATA_DIR, fname)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({
            "received_at_utc": datetime.utcnow().isoformat(),
            "hash_sha256": digest,
            "payload": payload.model_dump(),
            "version": "v0"
        }, f, indent=2)

    return {"ok": True, "hash": digest, "file": fname}

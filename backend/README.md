# Verity Backend

**Framework**: FastAPI

## Run (dev)
```bash
conda activate verity-backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
---------------------------------------------------------------------------------------------------------------
Endpoints

GET /health → { "status": "ok", "service": "verity-backend", "time": "..." }

POST /session → body { founder_inputs: { idea_summary, target_user, problems[], value_prop?, target_action? } }
returns { session_id } and saves backend/data/sessions/*.json

GET /script?session_id=... → returns interview steps[] for the session

POST /responses → body { session_id, respondent_id, answers{}, meta? }
saves backend/data/responses/*.json (rejects empty answers with 400)

POST /response → alias to /responses

POST /hash → body { "text": "..." }, returns { sha256, keccak } (400 when empty/whitespace)

GET /summary?session_id=... → { session_id, responses_count, first_ts, last_ts }

(optional if implemented) GET /export?session_id=... → { session_id, items: [ ... ] }

Quick tests (no jq)
# create a session
SID=$(curl -s http://localhost:8000/session \
  -H 'content-type: application/json' \
  -d '{"founder_inputs":{"idea_summary":"AI interview assistant","target_user":"founders","problems":["interviews"],"value_prop":"LLM interviewer","target_action":"sign up"}}' \
  | python -c 'import sys,json; print(json.load(sys.stdin)["session_id"])')

# fetch script + show first step id
curl -s "http://localhost:8000/script?session_id=$SID" \
  | python -c 'import sys,json; d=json.load(sys.stdin); print(d["session_id"]); print(d["steps"][0]["id"])'

# hash utility
curl -s http://localhost:8000/hash -H 'content-type: application/json' -d '{"text":"hello"}'
curl -s http://localhost:8000/hash -H 'content-type: application/json' -d '{"text":"   "}'

Data layout (local files)

All data is stored under backend/data/:

backend/data/
  sessions/                          # created by POST /session
    2025...Z_<session>.json          # { session_id, founder_inputs, created_at_utc, version }
  responses/                         # created by POST /responses
    2025...Z_<session>_<resp>_<hash12>.json
                                     # {
                                     #   received_at_utc, hash_sha256,
                                     #   payload: { session_id, respondent_id, answers{}, meta? },
                                     #   version
                                     # }


Filenames

Leading UTC stamp: YYYYMMDDTHHMMSSZ (sortable; used by /summary).

hash12: first 12 chars of SHA-256 of the serialized payload (stable de-dupe id).

Readers

/script loads founder_inputs from sessions/.

/summary counts files + derives first_ts/last_ts from filename stamps.

/export (if enabled) returns an array of JSON items from responses/.

Swagger UI: http://localhost:8000/docs
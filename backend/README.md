"# Backend service" 
# Verity Backend

**Framework**: FastAPI

## Run (dev)

```bash
conda activate verity-backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

## Endpoints

- `GET /health` → `{ "status": "ok", "service": "verity-backend", "time": "..." }`
- `POST /session` → body `{ founder_inputs: { idea_summary, target_user, problems[], value_prop?, target_action? } }`  
  returns `{ session_id }` and saves `backend/data/sessions/*.json`
- `POST /responses` → body `{ session_id, respondent_id, answers{}, meta? }`  
  saves `backend/data/responses/*.json`
- `POST /response` → alias to `/responses` (same payload)
- `GET /script?session_id=...` → returns interview steps[] for the given session
- `GET /script?session_id=...` → returns interview steps[] for the session
- `POST /responses` → rejects empty `answers` with 400

### Quick test (no jq)
SID=$(curl -s http://localhost:8000/session \
  -H "content-type: application/json" \
  -d '{"founder_inputs":{"idea_summary":"AI interview assistant","target_user":"founders","problems":["interviews"],"value_prop":"LLM interviewer","target_action":"sign up"}}' \
  | python -c 'import sys,json; print(json.load(sys.stdin)["session_id"])')
curl -s "http://localhost:8000/script?session_id=$SID" \
  | python -c 'import sys,json; d=json.load(sys.stdin); print(d["session_id"]); print(d["steps"][0]["id"])'
  - `POST /hash` → body `{ "text": "..." }`, returns `{ sha256, keccak }`.
  - 400 when `text` is empty/whitespace.

### Quick test
curl -s http://localhost:8000/hash -H "content-type: application/json" -d '{"text":"hello"}'
curl -s http://localhost:8000/hash -H "content-type: application/json" -d '{"text":"   "}'



- Swagger UI: http://localhost:8000/docs


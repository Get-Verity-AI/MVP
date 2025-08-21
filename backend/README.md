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

- Swagger UI: http://localhost:8000/docs


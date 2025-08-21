# Verity — Local Dev Runbook

This runbook explains how to bring up **backend + miniapp** and test end-to-end with curl.

## Terminals

- **T1 (backend, conda):**
  ```bash
  cd backend
  conda activate verity-backend
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
T2 (miniapp, node):

cd miniapp
pnpm install   # first time
pnpm dev       # shows Local: http://localhost:5173


T3 (curl tests):

curl -s http://localhost:8000/health

SID=$(curl -s http://localhost:8000/session \
  -H 'content-type: application/json' \
  -d '{"founder_inputs":{"idea_summary":"AI interview assistant","target_user":"founders","problems":["interviews"],"value_prop":"LLM interviewer","target_action":"sign up"}}' \
  | python -c 'import sys,json; print(json.load(sys.stdin)["session_id"])')
echo "SID=$SID"

curl -s "http://localhost:8000/script?session_id=$SID"
Open Miniapp

Browser →

http://localhost:5173/?session_id=<SID>


Proceed through the steps. At the end you’ll see a thank-you screen.

Verify persistence
ls backend/data/sessions
ls backend/data/responses

"# Backend service" 
# Verity Backend

**Framework**: FastAPI

## Run (dev)

```bash
conda activate verity-backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000



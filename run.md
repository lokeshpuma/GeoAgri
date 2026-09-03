cd /Users/lokesh/Documents/PRO/playground
PYTHONPATH=backend python3 backend/ml/training/train_models.py


cd /Users/lokesh/Documents/PRO/playground/backend
PYTHONPATH=. python3 -m pytest -v


cd /Users/lokesh/Documents/PRO/playground/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload


cd /Users/lokesh/Documents/PRO/playground/frontend
npm run dev

cd /Users/lokesh/Desktop/GeoAgri
PYTHONPATH=backend python3 backend/ml/training/train_models.py


cd /Users/lokesh/Desktop/GeoAgri/backend
PYTHONPATH=. python3 -m pytest -v


cd /Users/lokesh/Desktop/GeoAgri/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload


cd /Users/lokesh/Desktop/GeoAgri/frontend
npm run dev

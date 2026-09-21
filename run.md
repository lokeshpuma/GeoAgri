# GeoAgri AI – Execution Guide

### Option 1: Two Separate Terminals (Recommended)

#### Terminal 1: Backend (FastAPI on Port 8000)
```bash
cd ~/Desktop/GeoAgri/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```
> *(Or direct path: `cd ~/Desktop/GeoAgri/backend && ./venv/bin/uvicorn app.main:app --reload --port 8000`)*

#### Terminal 2: Frontend (React / Vite on Port 3000)
```bash
cd ~/Desktop/GeoAgri/frontend
npm run dev
```

---

### Option 2: Run Both Simultaneously in a Single Command
```bash
(cd ~/Desktop/GeoAgri/backend && ./venv/bin/uvicorn app.main:app --reload --port 8000) & (cd ~/Desktop/GeoAgri/frontend && npm run dev)
```

---

### Retraining ML Models & Running Automated Tests
```bash
# Retrain Models (Models B and D)
cd ~/Desktop/GeoAgri
PYTHONPATH=backend ./backend/venv/bin/python backend/ml/training/train_models.py

# Run Full PyTest Suite (Phases 2-7)
cd ~/Desktop/GeoAgri/backend
PYTHONPATH=. ./venv/bin/pytest -v
```

---

### URLs
* **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
* **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Backend Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

# Terminal 1: Backend
cd ~/Desktop/GeoAgri/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd ~/Desktop/GeoAgri/frontend
npm run dev

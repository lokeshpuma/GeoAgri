"""
Vercel Serverless Function Entrypoint for GeoAgri AI FastAPI Backend.
Allows hosting the backend directly as a Vercel Serverless Function.
"""
import os
import sys

# Ensure backend root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app

# Export app for Vercel ASGI handler
handler = app

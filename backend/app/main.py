"""
GeoAgri AI Backend Main Entrypoint.
Initializes FastAPI app, CORS middleware, routes, and crop registry loading.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import predict, field, health

app = FastAPI(
    title="GeoAgri AI – Global Agricultural Intelligence API",
    description="Location-driven global agricultural decision-support API for land analysis, crop selection, yield prediction, water balance, and climate risk.",
    version="1.0.0"
)

# Enable CORS for local React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(predict.router, prefix="/api/v1", tags=["Prediction"])
app.include_router(field.router, prefix="/api/v1", tags=["Field"])
app.include_router(health.router, prefix="/api/v1", tags=["Health & Crops"])

@app.get("/")
async def root():
    return {
        "title": "GeoAgri AI – Global Agricultural Intelligence API",
        "status": "online",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    reload = os.environ.get("ENV", "development").lower() == "development"
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=reload)

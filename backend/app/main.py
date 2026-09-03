"""
GeoAgri AI Backend Main Entrypoint.
Initializes FastAPI app, CORS middleware, routes, and crop registry loading.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import predict, field, health

app = FastAPI(
    title="GeoAgri AI – India Edition API",
    description="Location-driven agricultural decision-support API for crop selection, yield prediction, water balance, and climate risk.",
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
        "title": "GeoAgri AI – India Edition API",
        "status": "online",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

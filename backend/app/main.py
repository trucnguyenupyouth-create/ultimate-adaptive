"""
FastAPI application entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import graph, assessment, items, learning, sandbox
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing needed yet (graph loads lazily on first request)
    yield
    # Shutdown: close Redis connection if open
    from app.api.routes.assessment import _redis
    if _redis:
        await _redis.aclose()


app = FastAPI(
    title="Ultimate Adaptive Learning System",
    description="Adaptive learning engine: KST + IRT + BKT + Forgetting Curve",
    version="0.2.0-layer1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph.router)
app.include_router(assessment.router)
app.include_router(items.router)
app.include_router(learning.router)
app.include_router(sandbox.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "layer": "1+2",
        "version": "0.2.0-layer1",
        "cors_origins": settings.cors_origins_list,
    }

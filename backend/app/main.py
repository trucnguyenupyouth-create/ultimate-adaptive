"""
FastAPI application entry point.
"""

import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import graph, assessment, assessment_v2, items, learning, sandbox, question_gen, images, sandbox_assess
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: pre-connect shared Redis client
    from app.core.redis_client import get_redis
    await get_redis()
    yield
    # Shutdown: close shared Redis + assessment Redis
    from app.core.redis_client import close_redis
    await close_redis()
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
    expose_headers=["*"],
)

app.include_router(graph.router)
app.include_router(assessment.router)
app.include_router(assessment_v2.router)
app.include_router(items.router)
app.include_router(learning.router)
app.include_router(sandbox.router)
app.include_router(question_gen.router)
app.include_router(images.router)
app.include_router(sandbox_assess.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler so unhandled exceptions return proper JSON + CORS headers.
    Without this, a 500 crash bypasses CORS middleware → browser sees CORS error.
    """
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        },
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "layer": "1+2",
        "version": "0.2.0-layer1",
        "cors_origins": settings.cors_origins_list,
    }

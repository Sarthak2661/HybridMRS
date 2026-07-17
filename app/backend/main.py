from __future__ import annotations

import logging
import os
import time
from collections import Counter
from threading import Lock
from uuid import uuid4

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from app.backend.recommender import get_genres, metrics_payload, recommend, search_movies
from app.backend.schemas import FeedbackRequest, FeedbackResponse, RecommendationResponse, RecommendRequest


app = FastAPI(title="Hybrid Movie Recommendation API", version="1.0.0")
logger = logging.getLogger("hybridmrs.api")
if not logger.handlers:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

STARTED_AT = time.time()
METRICS_LOCK = Lock()
REQUEST_COUNTS = Counter()
STATUS_COUNTS = Counter()
TOTAL_LATENCY_MS = 0.0
LAST_REQUEST_AT: float | None = None


def allowed_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FEEDBACK_STORE: dict[str, dict[str, str]] = {}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    global TOTAL_LATENCY_MS, LAST_REQUEST_AT

    request_id = request.headers.get("x-request-id") or str(uuid4())[:8]
    started = time.perf_counter()
    response = None
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        latency_ms = (time.perf_counter() - started) * 1000
        client_host = request.client.host if request.client else "unknown"
        path = request.url.path
        method = request.method

        with METRICS_LOCK:
            REQUEST_COUNTS[f"{method} {path}"] += 1
            STATUS_COUNTS[str(status_code)] += 1
            TOTAL_LATENCY_MS += latency_ms
            LAST_REQUEST_AT = time.time()

        logger.info(
            "request_id=%s method=%s path=%s status=%s latency_ms=%.2f client=%s",
            request_id,
            method,
            path,
            status_code,
            latency_ms,
            client_host,
        )

        if response is not None:
            response.headers["x-request-id"] = request_id


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/monitoring")
def monitoring() -> dict:
    with METRICS_LOCK:
        total_requests = int(sum(REQUEST_COUNTS.values()))
        avg_latency_ms = round(TOTAL_LATENCY_MS / total_requests, 2) if total_requests else 0.0
        route_counts = dict(sorted(REQUEST_COUNTS.items()))
        status_counts = dict(sorted(STATUS_COUNTS.items()))
        last_request_at = LAST_REQUEST_AT

    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - STARTED_AT, 2),
        "total_requests": total_requests,
        "avg_latency_ms": avg_latency_ms,
        "route_counts": route_counts,
        "status_counts": status_counts,
        "last_request_at": last_request_at,
    }


@app.get("/movies/search")
def movies_search(
    query: str = Query(default="", max_length=120),
    limit: int = Query(default=12, ge=1, le=50),
    genres: list[str] = Query(default_factory=list),
):
    return {"movies": search_movies(query=query, limit=limit, genres=genres)}


@app.get("/genres")
def genres():
    return {"genres": get_genres()}


@app.post("/recommend", response_model=RecommendationResponse)
def recommend_movies(request: RecommendRequest):
    recs, catalog_metrics = recommend(request)
    return RecommendationResponse(
        recommendations=recs,
        selected_alpha=request.alpha,
        catalog_metrics=catalog_metrics,
    )


@app.post("/feedback", response_model=FeedbackResponse)
def feedback(request: FeedbackRequest):
    session_feedback = FEEDBACK_STORE.setdefault(request.session_id, {})
    session_feedback[str(request.movieId)] = request.action
    return FeedbackResponse(ok=True, feedback=session_feedback)


@app.get("/metrics")
def metrics():
    return metrics_payload()

from __future__ import annotations

import os

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.backend.recommender import get_genres, metrics_payload, recommend, search_movies
from app.backend.schemas import FeedbackRequest, FeedbackResponse, RecommendationResponse, RecommendRequest


app = FastAPI(title="Hybrid Movie Recommendation API", version="1.0.0")


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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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

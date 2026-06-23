from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RatedMovie(BaseModel):
    movieId: int
    rating: float = Field(ge=1.0, le=5.0)


class RecommendRequest(BaseModel):
    liked_movies: list[int] = Field(default_factory=list)
    rated_movies: list[RatedMovie] = Field(default_factory=list)
    favorite_genres: list[str] = Field(default_factory=list)
    alpha: float = Field(default=0.6, ge=0.0, le=1.0)
    novelty: float = Field(default=0.35, ge=0.0, le=1.0)
    top_k: int = Field(default=10, ge=1, le=50)
    genre_filter: list[str] = Field(default_factory=list)
    year_min: int | None = None
    year_max: int | None = None
    exclude_watched: bool = True
    feedback: dict[int, str] = Field(default_factory=dict)


class MovieSearchResult(BaseModel):
    movieId: int
    title: str
    year: int | None = None
    genres: list[str]
    posterUrl: str | None = None


class Recommendation(BaseModel):
    movieId: int
    title: str
    year: int | None = None
    genres: list[str]
    score: float
    cf_score: float
    content_score: float
    novelty_score: float
    posterUrl: str | None = None
    reason: str
    explanation_tags: list[str]


class RecommendationResponse(BaseModel):
    recommendations: list[Recommendation]
    selected_alpha: float
    catalog_metrics: dict[str, float]


class FeedbackRequest(BaseModel):
    movieId: int
    action: Literal["like", "dislike", "already_watched", "not_interested", "more_like_this"]
    session_id: str = "demo"


class FeedbackResponse(BaseModel):
    ok: bool
    feedback: dict[str, str]

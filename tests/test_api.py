from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.backend import main as api_main
from app.backend.schemas import Recommendation


@pytest.fixture()
def client() -> TestClient:
    return TestClient(api_main.app)


@pytest.fixture(autouse=True)
def clear_feedback_store() -> None:
    api_main.FEEDBACK_STORE.clear()


def sample_recommendations() -> list[Recommendation]:
    return [
        Recommendation(
            movieId=101,
            title="Toy Story (1995)",
            year=1995,
            genres=["Animation", "Children", "Comedy"],
            score=0.91,
            cf_score=0.62,
            content_score=0.77,
            novelty_score=0.25,
            posterUrl="https://example.com/poster1.jpg",
            reason="Recommended because you liked Toy Story.",
            explanation_tags=["Animation", "strong content match"],
        ),
        Recommendation(
            movieId=202,
            title="Finding Nemo (2003)",
            year=2003,
            genres=["Animation", "Adventure"],
            score=0.84,
            cf_score=0.58,
            content_score=0.74,
            novelty_score=0.29,
            posterUrl="https://example.com/poster2.jpg",
            reason="Recommended because you liked animated adventure movies.",
            explanation_tags=["Adventure", "high collaborative score"],
        ),
    ]


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_search_endpoint(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    called: dict[str, object] = {}

    def fake_search_movies(query: str, limit: int = 12, genres: list[str] | None = None):
        called["query"] = query
        called["limit"] = limit
        called["genres"] = genres
        return [
            {
                "movieId": 1,
                "title": "Toy Story (1995)",
                "year": 1995,
                "genres": ["Animation", "Children", "Comedy"],
                "posterUrl": "https://example.com/toy-story.jpg",
            }
        ]

    monkeypatch.setattr(api_main, "search_movies", fake_search_movies)
    response = client.get("/movies/search", params={"query": "toy", "limit": 5, "genres": ["Animation"]})

    assert response.status_code == 200
    payload = response.json()
    assert payload["movies"][0]["title"] == "Toy Story (1995)"
    assert called == {"query": "toy", "limit": 5, "genres": ["Animation"]}


def test_genre_endpoint(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(api_main, "get_genres", lambda: ["Action", "Comedy", "Drama"])
    response = client.get("/genres")
    assert response.status_code == 200
    assert response.json() == {"genres": ["Action", "Comedy", "Drama"]}


def test_recommend_endpoint(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_recommend(request):
        assert request.alpha == 0.6
        assert request.top_k == 10
        return sample_recommendations(), {"coverage": 0.12, "diversity": 0.55, "novelty": 0.33, "serendipity": 0.21}

    monkeypatch.setattr(api_main, "recommend", fake_recommend)
    response = client.post(
        "/recommend",
        json={
            "liked_movies": [1, 2],
            "rated_movies": [{"movieId": 1, "rating": 5}],
            "favorite_genres": ["Animation"],
            "alpha": 0.6,
            "novelty": 0.35,
            "top_k": 10,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["recommendations"]) == 2
    assert payload["recommendations"][0]["movieId"] == 101
    assert payload["catalog_metrics"]["coverage"] == 0.12


def test_feedback_endpoint(client: TestClient) -> None:
    response = client.post(
        "/feedback",
        json={"movieId": 101, "action": "like", "session_id": "demo-user"},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True, "feedback": {"101": "like"}}


def test_invalid_request_returns_422(client: TestClient) -> None:
    response = client.post(
        "/recommend",
        json={
            "liked_movies": [1],
            "rated_movies": [{"movieId": 1, "rating": 7}],
            "alpha": 1.5,
            "top_k": 0,
        },
    )
    assert response.status_code == 422


def test_metrics_endpoint(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        api_main,
        "metrics_payload",
        lambda: {
            "rows": [{"model": "Hybrid history-alpha", "ndcg_at_10": 0.05}],
            "summary": "Best recorded model by NDCG@10: Hybrid history-alpha",
            "is_legacy": False,
            "notice": "",
        },
    )
    response = client.get("/metrics")
    assert response.status_code == 200
    assert response.json()["summary"] == "Best recorded model by NDCG@10: Hybrid history-alpha"


def fake_catalog() -> tuple[pd.DataFrame, np.ndarray, list[str]]:
    movies = pd.DataFrame(
        [
            {
                "movieId": 1,
                "title": "Toy Story (1995)",
                "year": 1995,
                "genre_list": ["Animation", "Children", "Comedy"],
                "posterUrl": "https://example.com/1.jpg",
                "popularity_score": 3.0,
                "avg_rating": 4.2,
                "rating_count": 220,
            },
            {
                "movieId": 2,
                "title": "Finding Nemo (2003)",
                "year": 2003,
                "genre_list": ["Animation", "Adventure"],
                "posterUrl": "https://example.com/2.jpg",
                "popularity_score": 2.7,
                "avg_rating": 4.0,
                "rating_count": 180,
            },
            {
                "movieId": 3,
                "title": "Heat (1995)",
                "year": 1995,
                "genre_list": ["Action", "Crime", "Thriller"],
                "posterUrl": "https://example.com/3.jpg",
                "popularity_score": 2.5,
                "avg_rating": 4.1,
                "rating_count": 170,
            },
            {
                "movieId": 4,
                "title": "The Matrix (1999)",
                "year": 1999,
                "genre_list": ["Action", "Sci-Fi"],
                "posterUrl": "https://example.com/4.jpg",
                "popularity_score": 2.9,
                "avg_rating": 4.3,
                "rating_count": 250,
            },
        ]
    )
    matrix = np.array(
        [
            [1.0, 0.0, 0.0],
            [0.9, 0.1, 0.0],
            [0.1, 0.9, 0.2],
            [0.2, 0.8, 1.0],
        ],
        dtype=float,
    )
    return movies, matrix, ["f1", "f2", "f3"]


def install_fake_recommender_dependencies(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.backend import recommender

    monkeypatch.setattr(recommender, "content_matrix", fake_catalog)
    monkeypatch.setattr(
        recommender,
        "bayesian_rating_scores",
        lambda movies: pd.Series([0.92, 0.88, 0.51, 0.83], index=movies["movieId"]),
    )


def test_cold_start_user_falls_back_to_favorite_genres(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.backend import recommender
    from app.backend.schemas import RecommendRequest

    install_fake_recommender_dependencies(monkeypatch)
    request = RecommendRequest(
        liked_movies=[],
        rated_movies=[],
        favorite_genres=["Animation"],
        top_k=3,
    )
    recs, metrics = recommender.recommend(request)

    assert recs
    assert recs[0].movieId in {1, 2}
    assert metrics["coverage"] >= 0.0


def test_no_liked_movies_fallback_still_returns_recommendations(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.backend import recommender
    from app.backend.schemas import RecommendRequest

    install_fake_recommender_dependencies(monkeypatch)
    request = RecommendRequest(liked_movies=[], rated_movies=[], favorite_genres=[], top_k=3)
    recs, _ = recommender.recommend(request)

    assert len(recs) == 3
    assert {rec.movieId for rec in recs}.issubset({1, 2, 3, 4})


def test_filtering_by_year_and_genre(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.backend import recommender
    from app.backend.schemas import RecommendRequest

    install_fake_recommender_dependencies(monkeypatch)
    request = RecommendRequest(
        liked_movies=[1],
        rated_movies=[{"movieId": 1, "rating": 5}],
        genre_filter=["Sci-Fi"],
        year_min=1998,
        year_max=2000,
        top_k=5,
    )
    recs, _ = recommender.recommend(request)

    assert recs
    assert all("Sci-Fi" in rec.genres for rec in recs)
    assert all(rec.year is not None and 1998 <= rec.year <= 2000 for rec in recs)

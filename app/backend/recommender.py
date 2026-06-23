from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler

from app.backend.schemas import MovieSearchResult, RecommendRequest, Recommendation


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROCESSED_FEATURES = PROJECT_ROOT / "data" / "processed" / "ml32m_basic_movie_features.parquet"
METRICS_CSV = PROJECT_ROOT / "data" / "processed" / "model_comparison_metrics.csv"
MOVIES_CSV = PROJECT_ROOT / "data" / "raw" / "ml-32m" / "movies.csv"
RATINGS_CSV = PROJECT_ROOT / "data" / "raw" / "ml-32m" / "ratings.csv"
POSTERS_CSV = PROJECT_ROOT / "data" / "processed" / "movie_posters.csv"

BROAD_GENRE_WEIGHTS = {
    "Drama": 0.62,
    "Comedy": 0.68,
    "Action": 0.78,
    "Adventure": 0.84,
    "Romance": 0.86,
    "Thriller": 0.9,
}

NEGATIVE_FEEDBACK_ACTIONS = {"dislike", "not_interested"}
POSITIVE_FEEDBACK_ACTIONS = {"like", "more_like_this"}


def split_genres(value: str | float | None) -> list[str]:
    if not isinstance(value, str) or not value:
        return []
    return [part for part in value.split("|") if part and part != "(no genres listed)"]


def parse_year(title: str) -> int | None:
    match = re.search(r"\((\d{4})\)", title or "")
    return int(match.group(1)) if match else None


def poster_placeholder(movie_id: int, title: str) -> str:
    palettes = [
        ("172026", "f7f8f6"),
        ("3f6f5f", "f7f8f6"),
        ("c95f4a", "fff7ed"),
        ("2f4858", "e5f2ef"),
        ("5c4d7d", "f6f0ff"),
        ("8a5a44", "fff5ec"),
    ]
    bg, fg = palettes[int(movie_id) % len(palettes)]
    clean_title = re.sub(r"\s*\(\d{4}\)", "", title or "Movie").strip()
    short = "+".join(clean_title.split()[:4]) or f"Movie+{int(movie_id)}"
    return f"https://placehold.co/300x450/{bg}/{fg}?text={short}"


def normalize(values: pd.Series) -> pd.Series:
    min_value = values.min()
    max_value = values.max()
    if pd.isna(min_value) or pd.isna(max_value) or max_value == min_value:
        return pd.Series(np.zeros(len(values)), index=values.index)
    return (values - min_value) / (max_value - min_value)


def rating_profile_weight(rating: float) -> float:
    """Map 1-5 stars to a taste strength where 5-star movies define the profile most."""
    return max(0.0, (float(rating) - 3.0) / 2.0) ** 1.35


def bayesian_rating_scores(movies: pd.DataFrame, min_votes: int = 80) -> pd.Series:
    ratings = movies["avg_rating"].fillna(3.4).astype(float)
    counts = movies["rating_count"].fillna(0).astype(float)
    global_mean = float(ratings.mean()) if len(ratings) else 3.4
    weighted = ((counts / (counts + min_votes)) * ratings) + ((min_votes / (counts + min_votes)) * global_mean)
    return pd.Series(weighted.to_numpy(), index=movies["movieId"])


def genre_specificity_lookup(movies: pd.DataFrame) -> dict[str, float]:
    genre_counts: dict[str, int] = {}
    for genres in movies["genre_list"]:
        for genre in genres:
            genre_counts[genre] = genre_counts.get(genre, 0) + 1

    total = max(len(movies), 1)
    raw = {
        genre: np.log1p(total / max(count, 1)) * BROAD_GENRE_WEIGHTS.get(genre, 1.0)
        for genre, count in genre_counts.items()
    }
    max_value = max(raw.values(), default=1.0)
    return {genre: value / max_value for genre, value in raw.items()}


def movie_genre_specificity_scores(movies: pd.DataFrame, lookup: dict[str, float]) -> pd.Series:
    scores = movies["genre_list"].apply(
        lambda genres: float(np.mean([lookup.get(genre, 0.0) for genre in genres])) if genres else 0.0
    )
    return pd.Series(scores.to_numpy(), index=movies["movieId"])


@lru_cache(maxsize=1)
def load_catalog() -> pd.DataFrame:
    if PROCESSED_FEATURES.exists():
        try:
            movies = pd.read_parquet(PROCESSED_FEATURES)
            if "genres" not in movies.columns and MOVIES_CSV.exists():
                raw_movies = pd.read_csv(MOVIES_CSV, dtype={"movieId": "int32", "title": "string", "genres": "string"})
                movies = movies.merge(raw_movies[["movieId", "genres"]], on="movieId", how="left")
        except ImportError:
            movies = pd.read_csv(MOVIES_CSV, dtype={"movieId": "int32", "title": "string", "genres": "string"})
            movies = add_rating_stats(movies)
    elif MOVIES_CSV.exists():
        movies = pd.read_csv(MOVIES_CSV, dtype={"movieId": "int32", "title": "string", "genres": "string"})
        movies = add_rating_stats(movies)
    else:
        raise FileNotFoundError("Expected MovieLens data or processed feature parquet was not found.")

    movies["year"] = movies["year"].fillna(movies["title"].apply(parse_year))
    if "genres" not in movies.columns:
        movies["genres"] = ""
    movies["genres"] = movies["genres"].fillna("")
    movies["genre_list"] = movies["genres"].apply(split_genres)
    movies["posterUrl"] = movies.apply(
        lambda row: poster_placeholder(int(row["movieId"]), str(row["title"])),
        axis=1,
    )
    if POSTERS_CSV.exists():
        posters = pd.read_csv(POSTERS_CSV)
        if {"movieId", "posterUrl"}.issubset(posters.columns):
            movies = movies.merge(
                posters[["movieId", "posterUrl"]].rename(columns={"posterUrl": "realPosterUrl"}),
                on="movieId",
                how="left",
            )
            movies["posterUrl"] = movies["realPosterUrl"].fillna(movies["posterUrl"])
            movies = movies.drop(columns=["realPosterUrl"])
    return movies.reset_index(drop=True)


def add_rating_stats(movies: pd.DataFrame, n_rows: int = 2_000_000) -> pd.DataFrame:
    movies = movies.copy()
    movies["year"] = movies["title"].apply(parse_year)
    if RATINGS_CSV.exists():
        ratings = pd.read_csv(
            RATINGS_CSV,
            usecols=["movieId", "rating"],
            nrows=n_rows,
            dtype={"movieId": "int32", "rating": "float32"},
        )
        stats = (
            ratings.groupby("movieId")
            .agg(avg_rating=("rating", "mean"), rating_count=("rating", "count"))
            .reset_index()
        )
        movies = movies.merge(stats, on="movieId", how="left")
    else:
        movies["avg_rating"] = np.nan
        movies["rating_count"] = np.nan

    movies["avg_rating"] = movies["avg_rating"].fillna(3.4)
    movies["rating_count"] = movies["rating_count"].fillna(0)
    movies["popularity_score"] = np.log1p(movies["rating_count"])
    return movies


@lru_cache(maxsize=1)
def content_matrix() -> tuple[pd.DataFrame, np.ndarray, list[str]]:
    movies = load_catalog()
    genre_cols = [
        col
        for col in movies.columns
        if col.startswith("genre_") and col != "genre_list"
    ]
    base_cols = [
        col
        for col in ["avg_rating", "rating_count", "popularity_score", "year", "num_genres"]
        if col in movies.columns
    ]
    feature_cols = base_cols + genre_cols
    if not feature_cols:
        genre_dummies = movies["genre_list"].str.join("|").str.get_dummies().add_prefix("genre_")
        movies = pd.concat([movies, genre_dummies], axis=1)
        feature_cols = list(genre_dummies.columns)

    matrix = movies[feature_cols].fillna(0).astype(float).to_numpy()
    return movies, StandardScaler().fit_transform(matrix), feature_cols


def search_movies(query: str, limit: int = 12, genres: list[str] | None = None) -> list[MovieSearchResult]:
    movies = load_catalog()
    query = query.strip().lower()
    genre_set = {genre for genre in genres or [] if genre}
    candidates = movies

    if not query:
        if genre_set:
            candidates = candidates[candidates["genre_list"].apply(lambda movie_genres: bool(set(movie_genres) & genre_set))].copy()
            if candidates.empty:
                return []
            candidates["genre_match_count"] = candidates["genre_list"].apply(lambda movie_genres: len(set(movie_genres) & genre_set))
            candidates = candidates.sort_values(
                ["genre_match_count", "rating_count", "avg_rating"],
                ascending=[False, False, False],
            ).head(limit)
        else:
            candidates = candidates.sort_values(["rating_count", "avg_rating"], ascending=False).head(limit)
    else:
        mask = candidates["title"].str.lower().str.contains(re.escape(query), na=False)
        candidates = candidates[mask].copy()
        if genre_set:
            candidates = candidates[candidates["genre_list"].apply(lambda movie_genres: bool(set(movie_genres) & genre_set))].copy()
            if candidates.empty:
                return []
            candidates["genre_match_count"] = candidates["genre_list"].apply(lambda movie_genres: len(set(movie_genres) & genre_set))
            candidates = candidates.sort_values(
                ["genre_match_count", "rating_count", "avg_rating"],
                ascending=[False, False, False],
            ).head(limit)
        else:
            candidates = candidates.head(limit)

    return [
        MovieSearchResult(
            movieId=int(row.movieId),
            title=str(row.title),
            year=int(row.year) if pd.notna(row.year) and row.year else None,
            genres=list(row.genre_list),
            posterUrl=str(row.posterUrl),
        )
        for row in candidates.itertuples(index=False)
    ]


def get_genres() -> list[str]:
    movies = load_catalog()
    genres = sorted({genre for genres in movies["genre_list"] for genre in genres})
    return genres


def selected_movie_ids(request: RecommendRequest) -> list[int]:
    ids = list(request.liked_movies)
    ids.extend(movie.movieId for movie in request.rated_movies if movie.rating >= 4.0)
    return sorted(set(ids))


def user_profile_scores(request: RecommendRequest, movies: pd.DataFrame, matrix: np.ndarray) -> pd.Series:
    ratings_by_id = {int(movie.movieId): float(movie.rating) for movie in request.rated_movies}
    liked_ids = sorted(set(request.liked_movies) | {movie_id for movie_id, rating in ratings_by_id.items() if rating >= 3.5})
    id_to_idx = {int(movie_id): idx for idx, movie_id in enumerate(movies["movieId"])}
    indices = [id_to_idx[movie_id] for movie_id in liked_ids if movie_id in id_to_idx]
    specificity = genre_specificity_lookup(movies)

    if not indices and request.favorite_genres:
        favorite_set = set(request.favorite_genres)
        genre_pref = movies["genre_list"].apply(
            lambda genres: sum(specificity.get(genre, 0.0) for genre in set(genres) & favorite_set)
        )
        return normalize(genre_pref.astype(float))

    if not indices:
        return pd.Series(np.zeros(len(movies)), index=movies["movieId"])

    weights = np.array(
        [
            rating_profile_weight(ratings_by_id.get(movie_id, 5.0))
            for movie_id in liked_ids
            if movie_id in id_to_idx
        ]
    )
    if weights.sum() <= 0:
        weights = np.ones(len(indices))
    profile = np.average(matrix[indices], axis=0, weights=weights).reshape(1, -1)
    sims = cosine_similarity(profile, matrix).ravel()

    if request.favorite_genres:
        favorite_set = set(request.favorite_genres)
        genre_bonus = movies["genre_list"].apply(
            lambda genres: sum(specificity.get(genre, 0.0) for genre in set(genres) & favorite_set)
        )
        sims = sims + 0.1 * normalize(genre_bonus.astype(float)).to_numpy()

    selected_genres: dict[str, float] = {}
    for movie_id in liked_ids:
        if movie_id not in id_to_idx:
            continue
        movie_genres = movies.iloc[id_to_idx[movie_id]]["genre_list"]
        movie_weight = rating_profile_weight(ratings_by_id.get(movie_id, 5.0))
        for genre in movie_genres:
            selected_genres[genre] = selected_genres.get(genre, 0.0) + movie_weight * specificity.get(genre, 0.0)
    if selected_genres:
        genre_profile = movies["genre_list"].apply(
            lambda genres: sum(selected_genres.get(genre, 0.0) for genre in set(genres))
        )
        sims = sims + 0.12 * normalize(genre_profile.astype(float)).to_numpy()

    return pd.Series(sims, index=movies["movieId"])


def candidate_pool(
    cf_scores: pd.Series,
    content_scores: pd.Series,
    popularity_scores: pd.Series,
    seen_ids: set[int],
) -> pd.Index:
    cf_top = cf_scores[~cf_scores.index.isin(seen_ids)].sort_values(ascending=False).head(200).index
    content_top = content_scores[~content_scores.index.isin(seen_ids)].sort_values(ascending=False).head(200).index
    popular_top = popularity_scores[~popularity_scores.index.isin(seen_ids)].sort_values(ascending=False).head(50).index
    return cf_top.union(content_top).union(popular_top)


def remove_low_confidence_movies(candidates: pd.DataFrame, min_ratings: int = 20) -> pd.DataFrame:
    if "rating_count" not in candidates.columns or candidates["rating_count"].max() <= 0:
        return candidates
    confident = candidates[candidates["rating_count"].fillna(0) >= min_ratings]
    return confident if len(confident) >= 25 else candidates


def apply_filters(candidates: pd.DataFrame, request: RecommendRequest) -> pd.DataFrame:
    filtered = candidates
    if request.genre_filter:
        genre_set = set(request.genre_filter)
        filtered = filtered[filtered["genre_list"].apply(lambda genres: bool(set(genres) & genre_set))]
    if request.year_min is not None:
        filtered = filtered[filtered["year"].fillna(0) >= request.year_min]
    if request.year_max is not None:
        filtered = filtered[filtered["year"].fillna(9999) <= request.year_max]
    return filtered


def similarity_from_movie_ids(movie_ids: Iterable[int], movies: pd.DataFrame, matrix: np.ndarray) -> pd.Series:
    id_to_idx = {int(movie_id): idx for idx, movie_id in enumerate(movies["movieId"])}
    indices = [id_to_idx[int(movie_id)] for movie_id in movie_ids if int(movie_id) in id_to_idx]
    if not indices:
        return pd.Series(np.zeros(len(movies)), index=movies["movieId"])
    profile = matrix[indices].mean(axis=0).reshape(1, -1)
    sims = cosine_similarity(profile, matrix).ravel()
    return normalize(pd.Series(sims, index=movies["movieId"]))


def feedback_similarity_scores(request: RecommendRequest, movies: pd.DataFrame, matrix: np.ndarray) -> tuple[pd.Series, pd.Series]:
    negative_ids = [int(movie_id) for movie_id, action in request.feedback.items() if action in NEGATIVE_FEEDBACK_ACTIONS]
    positive_ids = [int(movie_id) for movie_id, action in request.feedback.items() if action in POSITIVE_FEEDBACK_ACTIONS]
    low_rated_ids = [int(movie.movieId) for movie in request.rated_movies if movie.rating <= 2.5]
    negative_scores = similarity_from_movie_ids([*negative_ids, *low_rated_ids], movies, matrix)
    positive_scores = similarity_from_movie_ids(positive_ids, movies, matrix)
    return negative_scores, positive_scores


def explanation_for(row: pd.Series, request: RecommendRequest, liked_titles: list[str]) -> tuple[str, list[str]]:
    matched_genres = sorted(set(row["genre_list"]) & set(request.favorite_genres))
    liked_text = ", ".join(liked_titles[:3]) if liked_titles else "your selected movies"
    tags = []
    if matched_genres:
        tags.extend(matched_genres[:3])
    if row["cf_norm"] >= 0.7:
        tags.append("high collaborative score")
    if row["content_norm"] >= 0.7:
        tags.append("strong content match")
    if row.get("genre_specificity_score", 0.0) >= 0.55:
        tags.append("specific genre match")
    if row.get("positive_feedback_score", 0.0) >= 0.7:
        tags.append("feedback boost")
    if row["novelty_score"] >= 0.6:
        tags.append("less obvious pick")

    reason_parts = [f"Recommended because you liked {liked_text}."]
    if matched_genres:
        reason_parts.append(f"Similar genres: {', '.join(matched_genres[:3])}.")
    if row["cf_norm"] >= 0.7:
        reason_parts.append("High collaborative filtering score among users with similar taste.")
    if row.get("genre_specificity_score", 0.0) >= 0.55:
        reason_parts.append("Specific genre matches are weighted more than broad genres.")
    if row.get("positive_feedback_score", 0.0) >= 0.7:
        reason_parts.append("Similar to movies you marked as like or more like this.")
    if row["novelty_score"] >= 0.6:
        reason_parts.append("Adds novelty beyond the most popular movies.")

    return " ".join(reason_parts), tags[:5]


def recommendation_metrics(recommendations: pd.DataFrame, catalog_size: int) -> dict[str, float]:
    if recommendations.empty:
        return {"coverage": 0.0, "diversity": 0.0, "novelty": 0.0, "serendipity": 0.0}
    coverage = len(recommendations["movieId"].unique()) / max(catalog_size, 1)
    genre_sets = recommendations["genre_list"].apply(set).tolist()
    distances = []
    for i, left in enumerate(genre_sets):
        for right in genre_sets[i + 1:]:
            union = left | right
            distances.append(1.0 - (len(left & right) / len(union) if union else 0.0))
    diversity = float(np.mean(distances)) if distances else 0.0
    novelty = float(recommendations["novelty_score"].mean())
    serendipity = float((recommendations["content_norm"] * recommendations["novelty_score"]).mean())
    return {
        "coverage": round(coverage, 5),
        "diversity": round(diversity, 4),
        "novelty": round(novelty, 4),
        "serendipity": round(serendipity, 4),
    }


def recommend(request: RecommendRequest) -> tuple[list[Recommendation], dict[str, float]]:
    movies, matrix, _ = content_matrix()
    selected_ids = selected_movie_ids(request)
    rated_ids = {int(movie.movieId) for movie in request.rated_movies}
    seen_ids = (set(selected_ids) | rated_ids) if request.exclude_watched else set()
    seen_ids.update(int(movie_id) for movie_id, action in request.feedback.items() if action in {"already_watched", "not_interested", "dislike"})

    content_scores = user_profile_scores(request, movies, matrix)
    cf_scores = bayesian_rating_scores(movies)
    popularity_scores = pd.Series(movies["popularity_score"].fillna(0).to_numpy(), index=movies["movieId"])
    confidence_scores = normalize(popularity_scores)
    novelty_scores = (1.0 - confidence_scores) * (0.35 + 0.65 * confidence_scores)
    genre_specificity_scores = movie_genre_specificity_scores(movies, genre_specificity_lookup(movies))
    negative_feedback_scores, positive_feedback_scores = feedback_similarity_scores(request, movies, matrix)

    ids = candidate_pool(cf_scores, content_scores, popularity_scores, seen_ids)
    recs = movies[movies["movieId"].isin(ids)].copy()
    recs = remove_low_confidence_movies(recs)
    recs = apply_filters(recs, request)
    if recs.empty:
        recs = movies[movies["movieId"].isin(ids)].copy()

    recs = recs.set_index("movieId")
    recs["cf_score"] = cf_scores.reindex(recs.index).fillna(cf_scores.mean())
    recs["content_score"] = content_scores.reindex(recs.index).fillna(content_scores.mean())
    recs["novelty_score"] = novelty_scores.reindex(recs.index).fillna(0.0)
    recs["genre_specificity_score"] = genre_specificity_scores.reindex(recs.index).fillna(0.0)
    recs["negative_feedback_score"] = negative_feedback_scores.reindex(recs.index).fillna(0.0)
    recs["positive_feedback_score"] = positive_feedback_scores.reindex(recs.index).fillna(0.0)
    recs["cf_norm"] = normalize(recs["cf_score"])
    recs["content_norm"] = normalize(recs["content_score"])
    recs["score"] = (
        request.alpha * recs["cf_norm"]
        + (1.0 - request.alpha) * recs["content_norm"]
        + request.novelty * 0.25 * recs["novelty_score"]
        + 0.08 * recs["genre_specificity_score"]
        + 0.08 * recs["positive_feedback_score"]
        - 0.22 * recs["negative_feedback_score"]
    )

    feedback_boosts = {"like": 0.08, "more_like_this": 0.1, "dislike": -0.5, "not_interested": -0.5, "already_watched": -0.5}
    for movie_id, action in request.feedback.items():
        if int(movie_id) in recs.index:
            recs.loc[int(movie_id), "score"] += feedback_boosts.get(action, 0.0)

    recs = recs.sort_values("score", ascending=False).head(request.top_k).reset_index()
    liked_titles = movies[movies["movieId"].isin(selected_ids)]["title"].astype(str).head(3).tolist()

    recommendations = []
    for row in recs.to_dict(orient="records"):
        reason, tags = explanation_for(pd.Series(row), request, liked_titles)
        recommendations.append(
            Recommendation(
                movieId=int(row["movieId"]),
                title=str(row["title"]),
                year=int(row["year"]) if pd.notna(row["year"]) and row["year"] else None,
                genres=list(row["genre_list"]),
                score=round(float(row["score"]), 4),
                cf_score=round(float(row["cf_score"]), 4),
                content_score=round(float(row["content_score"]), 4),
                novelty_score=round(float(row["novelty_score"]), 4),
                posterUrl=str(row["posterUrl"]),
                reason=reason,
                explanation_tags=tags,
            )
        )

    return recommendations, recommendation_metrics(recs, len(movies))


def metrics_payload() -> dict:
    if not METRICS_CSV.exists():
        return {"rows": [], "summary": "Run src/evaluate_models.py to generate current metrics."}
    df = pd.read_csv(METRICS_CSV)
    rows = json.loads(df.fillna("").to_json(orient="records"))
    best = df.sort_values("ndcg_at_10", ascending=False).head(1)
    summary = "No metrics available."
    if not best.empty:
        summary = f"Best recorded model by NDCG@10: {best.iloc[0]['model']}"
    required_current_cols = {"evaluation_phase", "split_strategy", "hit_rate_at_10", "selected_alpha"}
    is_legacy = not required_current_cols.issubset(set(df.columns))
    notice = ""
    if is_legacy:
        notice = (
            "Legacy metrics file detected. These rows are displayed for transparency, "
            "but regenerate metrics with src/evaluate_models.py for the upgraded validation/test evaluator."
        )
    return {
        "rows": rows,
        "summary": summary,
        "is_legacy": is_legacy,
        "notice": notice,
    }

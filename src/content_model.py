from __future__ import annotations
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
from src.features import load_basic_movie_features
from src.loaders import load_ml32m_ratings_sample


def build_content_matrices(k_best: int = 12):
    movies = load_basic_movie_features()

    #feature columns (numeric + genre)
    base_cols = ["avg_rating", "rating_count", "popularity_score", "year"]
    genre_cols = [c for c in movies.columns if c.startswith("genre_")]
    feature_cols = base_cols + genre_cols

    # design matrix
    X = movies[feature_cols].fillna(0.0).astype("float32").values
    y = movies["avg_rating"].values  # target for feature selection

    #Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # SelectKBest (content dimensionality reduction)
    selector = SelectKBest(score_func=f_regression, k=min(k_best, X_scaled.shape[1]))
    X_kbest = selector.fit_transform(X_scaled, y)
    kbest_mask = selector.get_support()

    movie_ids = movies["movieId"].values

    print(f"Content matrix (FULL): shape={X_scaled.shape}, "
          f"K-BEST: shape={X_kbest.shape}")
    selected_names = [name for name, keep in zip(feature_cols, kbest_mask) if keep]
    print("Selected features (K-BEST):", selected_names)

    return movie_ids, X_scaled, X_kbest, kbest_mask, feature_cols


def build_user_profile_from_ratings(
    user_id: int,
    ratings: pd.DataFrame,
    movie_ids: np.ndarray,
    feature_matrix: np.ndarray,
    min_rating: float = 4.0,
) -> np.ndarray:

    user_ratings = ratings[ratings["userId"] == user_id]
    if user_ratings.empty:
        raise ValueError(f"No ratings found for user {user_id}")

    # Movies the user liked
    liked = user_ratings[user_ratings["rating"] >= min_rating]
    if liked.empty:
        liked = user_ratings

    movie_index = {mid: idx for idx, mid in enumerate(movie_ids)}

    idxs: List[int] = []
    weights: List[float] = []
    for _, row in liked.iterrows():
        mid = int(row["movieId"])
        if mid in movie_index:
            idxs.append(movie_index[mid])
            weights.append(float(row["rating"]))

    if not idxs:
        raise ValueError(
            f"User {user_id} has no liked movies present in the feature table."
        )

    liked_vectors = feature_matrix[idxs]
    weights_arr = np.array(weights, dtype="float32").reshape(-1, 1)

    # rating-weighted average
    profile = np.sum(liked_vectors * weights_arr, axis=0) / np.sum(weights_arr)
    return profile


def recommend_content_for_user(
    user_id: int,
    feature_matrix: np.ndarray,
    movie_ids: np.ndarray,
    top_n: int = 10,
    ratings_df: Optional[pd.DataFrame] = None,
    ratings_sample_n: Optional[int] = None,
    min_rating: float = 4.0,
    exclude_seen: bool = True,
) -> List[Tuple[int, float]]:

    # ratings
    if ratings_df is None:
        if ratings_sample_n is None:
            ratings_df = load_ml32m_ratings_sample()
        else:
            ratings_df = load_ml32m_ratings_sample(n_rows=ratings_sample_n)

    # Builds user profile
    profile = build_user_profile_from_ratings(
        user_id=user_id,
        ratings=ratings_df,
        movie_ids=movie_ids,
        feature_matrix=feature_matrix,
        min_rating=min_rating,
    )

    # Cosine similarity
    sims = cosine_similarity(profile.reshape(1, -1), feature_matrix).flatten()

    # exclude movies the user has already seen
    if exclude_seen:
        seen_movie_ids = set(
            ratings_df.loc[ratings_df["userId"] == user_id, "movieId"].tolist()
        )
        mask_seen = np.array([mid in seen_movie_ids for mid in movie_ids])
        sims[mask_seen] = -1.0  # push seen movies to the bottom

    # Picking top-N movies
    top_idx = np.argsort(sims)[::-1][:top_n]
    recommendations: List[Tuple[int, float]] = [
        (int(movie_ids[i]), float(sims[i])) for i in top_idx
    ]

    return recommendations

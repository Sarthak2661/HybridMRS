import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_selection import SelectKBest, f_regression
from src.config import PROCESSED_DATA_DIR
from src.loaders import load_ml32m_ratings_sample

def load_basic_features():
    path = PROCESSED_DATA_DIR / "ml32m_basic_movie_features.parquet"
    print(f"Loading basic movie features from {path} ...")
    df = pd.read_parquet(path)
    return df


def build_content_matrix_kbest(k_best: int = 12):

    features_df = load_basic_features()

    # content columns: numeric + genre multi-hot
    base_cols = ["avg_rating", "rating_count", "popularity_score"]
    genre_cols = [c for c in features_df.columns if c.startswith("genre_")]
    content_cols = base_cols + genre_cols

    X = features_df[content_cols].fillna(0).astype(float)
    # scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    y = features_df["avg_rating"].values

    selector = SelectKBest(score_func=f_regression, k=k_best)
    X_kbest = selector.fit_transform(X_scaled, y)
    selected_indices = selector.get_support(indices=True)
    selected_cols = [content_cols[i] for i in selected_indices]

    print(f"Content matrix (full): {X_scaled.shape}, k-best: {X_kbest.shape}")
    print(f"Selected features (k-best): {selected_cols}")

    return features_df, X_kbest, selected_cols, scaler


def get_user_content_scores_kbest(
    user_id: int,
    ratings_df: pd.DataFrame,
    features_df: pd.DataFrame,
    X_kbest: np.ndarray,
    alpha_min_ratings: int = 5,
) -> pd.Series:

    # movies this user has rated
    user_ratings = ratings_df[ratings_df["userId"] == user_id]

    if len(user_ratings) < alpha_min_ratings:
        print(f"User {user_id} has only {len(user_ratings)} ratings; "
              f"content profile may be weak.")

    watched_ids = user_ratings["movieId"].unique()

    id_to_idx = {mid: idx for idx, mid in enumerate(features_df["movieId"].values)}

    watched_indices = [id_to_idx[mid] for mid in watched_ids if mid in id_to_idx]
    if not watched_indices:
        raise ValueError(f"User {user_id} has no movies present in features table.")

    user_profile = X_kbest[watched_indices].mean(axis=0, keepdims=True)

    sims = cosine_similarity(user_profile, X_kbest)[0]  # shape (n_movies,)

    # Build Series indexed by movieId
    content_scores = pd.Series(
        sims,
        index=features_df["movieId"],
        name="content_score",
    )
    return content_scores


def normalize_scores(scores: pd.Series) -> pd.Series:
    score_min = scores.min()
    score_max = scores.max()
    if pd.isna(score_min) or pd.isna(score_max) or score_max == score_min:
        return pd.Series(np.zeros(len(scores)), index=scores.index)
    return (scores - score_min) / (score_max - score_min)


def alpha_for_user_history(
    n_train_ratings: int,
    default_alpha: float = 0.6,
    new_user_alpha: float = 0.25,
    medium_user_alpha: float = 0.5,
    heavy_user_alpha: float = 0.75,
) -> float:
    if n_train_ratings <= 10:
        return new_user_alpha
    if n_train_ratings <= 50:
        return medium_user_alpha
    if n_train_ratings >= 100:
        return heavy_user_alpha
    return default_alpha


def build_hybrid_candidate_pool(
    cf_scores: pd.Series,
    content_scores: pd.Series,
    popularity_scores: pd.Series,
    seen_movie_ids: set[int],
    cf_top_n: int = 200,
    content_top_n: int = 200,
    popular_top_n: int = 50,
) -> pd.Index:
    cf_candidates = (
        cf_scores[~cf_scores.index.isin(seen_movie_ids)]
        .sort_values(ascending=False)
        .head(cf_top_n)
        .index
    )
    content_candidates = (
        content_scores[~content_scores.index.isin(seen_movie_ids)]
        .sort_values(ascending=False)
        .head(content_top_n)
        .index
    )
    popular_candidates = (
        popularity_scores[~popularity_scores.index.isin(seen_movie_ids)]
        .sort_values(ascending=False)
        .head(popular_top_n)
        .index
    )
    return cf_candidates.union(content_candidates).union(popular_candidates)


def rerank_hybrid_candidates(
    user_id: int,
    features_df: pd.DataFrame,
    cf_scores: pd.Series,
    content_scores: pd.Series,
    popularity_scores: pd.Series,
    seen_movie_ids: set[int],
    alpha: float,
    top_n: int = 10,
    cf_top_n: int = 200,
    content_top_n: int = 200,
    popular_top_n: int = 50,
) -> pd.DataFrame:
    candidate_ids = build_hybrid_candidate_pool(
        cf_scores=cf_scores,
        content_scores=content_scores,
        popularity_scores=popularity_scores,
        seen_movie_ids=seen_movie_ids,
        cf_top_n=cf_top_n,
        content_top_n=content_top_n,
        popular_top_n=popular_top_n,
    )

    candidate_cf = cf_scores.reindex(candidate_ids).fillna(cf_scores.mean())
    candidate_content = content_scores.reindex(candidate_ids).fillna(content_scores.mean())
    cf_norm = normalize_scores(candidate_cf)
    content_norm = normalize_scores(candidate_content)
    hybrid_score = alpha * cf_norm + (1.0 - alpha) * content_norm

    rec_df = pd.DataFrame(
        {
            "movieId": candidate_ids.astype(int),
            "cf_score": candidate_cf.to_numpy(),
            "content_score": candidate_content.to_numpy(),
            "cf_norm": cf_norm.to_numpy(),
            "content_norm": content_norm.to_numpy(),
            "hybrid_score": hybrid_score.to_numpy(),
            "alpha": alpha,
            "userId": user_id,
        }
    )
    rec_df = rec_df.merge(
        features_df[["movieId", "title"]],
        on="movieId",
        how="left",
    )
    return rec_df.sort_values("hybrid_score", ascending=False).head(top_n).reset_index(drop=True)


def recommend_hybrid(
    user_id: int,
    algo,
    ratings_df: pd.DataFrame,
    features_df: pd.DataFrame,
    X_kbest: np.ndarray,
    alpha: float = 0.6,
    top_n: int = 10,
    filter_seen: bool = True,
    use_history_alpha: bool = False,
    cf_top_n: int = 200,
    content_top_n: int = 200,
    popular_top_n: int = 50,
):

    # Content scores
    content_scores = get_user_content_scores_kbest(
        user_id=user_id,
        ratings_df=ratings_df,
        features_df=features_df,
        X_kbest=X_kbest,
    )

    # CF scores for all movies present in features_df
    all_movie_ids = features_df["movieId"].values
    cf_scores_list = []
    for mid in all_movie_ids:
        est = algo.predict(user_id, mid).est
        cf_scores_list.append(est)
    cf_scores = pd.Series(cf_scores_list, index=features_df["movieId"], name="cf_score")

    popularity_scores = pd.Series(
        features_df["avg_rating"].to_numpy() * np.log1p(features_df["rating_count"].to_numpy()),
        index=features_df["movieId"],
        name="popularity_score",
    )

    watched_ids = set()
    if filter_seen:
        watched_ids = set(ratings_df[ratings_df["userId"] == user_id]["movieId"].astype(int))

    if use_history_alpha:
        n_train_ratings = int((ratings_df["userId"] == user_id).sum())
        alpha = alpha_for_user_history(n_train_ratings, default_alpha=alpha)

    return rerank_hybrid_candidates(
        user_id=user_id,
        features_df=features_df,
        cf_scores=cf_scores,
        content_scores=content_scores,
        popularity_scores=popularity_scores,
        seen_movie_ids=watched_ids,
        alpha=alpha,
        top_n=top_n,
        cf_top_n=cf_top_n,
        content_top_n=content_top_n,
        popular_top_n=popular_top_n,
    )

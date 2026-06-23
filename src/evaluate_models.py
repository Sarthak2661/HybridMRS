from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
from surprise import Dataset, Reader, SVD

from src.config import PROCESSED_DATA_DIR
from src.features import extract_year_from_title
from src.hybrid_model import alpha_for_user_history, build_hybrid_candidate_pool
from src.loaders import load_ml32m_movies, load_ml32m_ratings_sample


@dataclass
class UserHoldout:
    user_id: int
    train_ratings: pd.DataFrame
    validation_relevant: set[int]
    test_relevant: set[int]


def precision_recall_ndcg_at_k(
    recommended_ids: Sequence[int],
    relevant_ids: Iterable[int],
    k: int = 10,
) -> tuple[float, float, float, float]:
    relevant_set = set(relevant_ids)
    rec_k = list(recommended_ids[:k])
    if not rec_k:
        return 0.0, 0.0, 0.0, 0.0

    hits = [1 if mid in relevant_set else 0 for mid in rec_k]
    precision = sum(hits) / k
    recall = sum(hits) / len(relevant_set) if relevant_set else 0.0
    hit_rate = 1.0 if any(hits) else 0.0

    dcg = sum(hit / np.log2(i + 2) for i, hit in enumerate(hits))
    ideal_hits = min(len(relevant_set), k)
    idcg = sum(1.0 / np.log2(i + 2) for i in range(ideal_hits))
    ndcg = dcg / idcg if idcg > 0 else 0.0

    return precision, recall, ndcg, hit_rate


def chronological_user_holdouts(
    ratings_df: pd.DataFrame,
    min_train_ratings: int = 5,
    validation_items_per_user: int = 1,
    test_items_per_user: int = 1,
    relevance_threshold: float = 4.0,
    max_users: int = 50,
    random_state: int = 42,
) -> tuple[pd.DataFrame, list[UserHoldout]]:
    """Hide recent liked movies for validation/test and train on older ratings."""
    rng = np.random.default_rng(random_state)
    user_ids = ratings_df["userId"].drop_duplicates().to_numpy().copy()
    rng.shuffle(user_ids)

    holdouts: list[UserHoldout] = []

    for user_id in user_ids:
        user_ratings = ratings_df[ratings_df["userId"] == user_id].sort_values("timestamp")
        if len(user_ratings) <= min_train_ratings:
            continue

        liked = user_ratings[user_ratings["rating"] >= relevance_threshold]
        holdout_items = liked.tail(validation_items_per_user + test_items_per_user)
        if len(holdout_items) < validation_items_per_user + test_items_per_user:
            continue

        validation_items = holdout_items.head(validation_items_per_user)
        test_items = holdout_items.tail(test_items_per_user)
        first_holdout_position = user_ratings.index.get_indexer(holdout_items.index).min()
        train_user = user_ratings.iloc[:first_holdout_position]
        if len(train_user) < min_train_ratings:
            continue

        holdouts.append(
            UserHoldout(
                user_id=int(user_id),
                train_ratings=train_user,
                validation_relevant=set(validation_items["movieId"].astype(int)),
                test_relevant=set(test_items["movieId"].astype(int)),
            )
        )

        if len(holdouts) >= max_users:
            break

    if not holdouts:
        raise ValueError(
            "No eligible users found. Try increasing n_rating_rows or lowering "
            "min_train_ratings/test_items_per_user."
        )

    holdout_user_ids = {holdout.user_id for holdout in holdouts}
    non_holdout_train = ratings_df[~ratings_df["userId"].isin(holdout_user_ids)]
    holdout_train = pd.concat(
        [holdout.train_ratings for holdout in holdouts],
        ignore_index=True,
    )
    train_df = pd.concat([non_holdout_train, holdout_train], ignore_index=True)

    return train_df, holdouts


def build_eval_features(train_df: pd.DataFrame) -> pd.DataFrame:
    movies = load_ml32m_movies()
    stats = (
        train_df.groupby("movieId")
        .agg(
            avg_rating=("rating", "mean"),
            rating_count=("rating", "count"),
        )
        .reset_index()
    )
    stats["popularity_score"] = np.log1p(stats["rating_count"])

    features_df = movies.merge(stats, on="movieId", how="left")
    features_df["avg_rating"] = features_df["avg_rating"].fillna(train_df["rating"].mean())
    features_df["rating_count"] = features_df["rating_count"].fillna(0)
    features_df["popularity_score"] = features_df["popularity_score"].fillna(0)
    features_df["year"] = features_df["title"].apply(extract_year_from_title).fillna(0)
    features_df["genre_list"] = (
        features_df["genres"]
        .replace("(no genres listed)", "")
        .fillna("")
        .apply(lambda value: value.split("|") if value else [])
    )
    features_df["num_genres"] = features_df["genre_list"].apply(len)

    genre_dummies = features_df["genre_list"].str.join("|").str.get_dummies()
    genre_dummies = genre_dummies.add_prefix("genre_")
    features_df = pd.concat([features_df, genre_dummies], axis=1)

    return features_df


def build_content_matrix(features_df: pd.DataFrame, full: bool = True) -> tuple[np.ndarray, list[str]]:
    genre_cols = [
        col
        for col in features_df.columns
        if col.startswith("genre_") and col != "genre_list"
    ]
    if full:
        content_cols = [
            "avg_rating",
            "rating_count",
            "popularity_score",
            "year",
            "num_genres",
        ] + genre_cols
    else:
        content_cols = genre_cols

    matrix = features_df[content_cols].fillna(0).astype(float).to_numpy()
    matrix = StandardScaler().fit_transform(matrix)
    return matrix, content_cols


def train_cf_svd(train_df: pd.DataFrame, random_state: int = 42) -> SVD:
    reader = Reader(rating_scale=(train_df["rating"].min(), train_df["rating"].max()))
    data = Dataset.load_from_df(train_df[["userId", "movieId", "rating"]], reader)
    algo = SVD(random_state=random_state)
    algo.fit(data.build_full_trainset())
    return algo


def normalize_scores(scores: pd.Series) -> pd.Series:
    score_min = scores.min()
    score_max = scores.max()
    if pd.isna(score_min) or pd.isna(score_max) or score_max == score_min:
        return pd.Series(np.zeros(len(scores)), index=scores.index)
    return (scores - score_min) / (score_max - score_min)


def user_content_scores(
    holdout: UserHoldout,
    features_df: pd.DataFrame,
    feature_matrix: np.ndarray,
    relevance_threshold: float = 4.0,
) -> pd.Series:
    movie_to_idx = {
        int(movie_id): idx
        for idx, movie_id in enumerate(features_df["movieId"].to_numpy())
    }
    liked_train = holdout.train_ratings[
        holdout.train_ratings["rating"] >= relevance_threshold
    ]
    if liked_train.empty:
        liked_train = holdout.train_ratings

    indices = [
        movie_to_idx[int(movie_id)]
        for movie_id in liked_train["movieId"].to_numpy()
        if int(movie_id) in movie_to_idx
    ]
    if not indices:
        return pd.Series(np.zeros(len(features_df)), index=features_df["movieId"])

    weights = liked_train[
        liked_train["movieId"].isin(movie_to_idx.keys())
    ]["rating"].to_numpy(dtype=float)
    if len(weights) != len(indices):
        weights = np.ones(len(indices))

    profile = np.average(feature_matrix[indices], axis=0, weights=weights).reshape(1, -1)
    sims = cosine_similarity(profile, feature_matrix).ravel()
    return pd.Series(sims, index=features_df["movieId"])


def top_k_from_scores(
    scores: pd.Series,
    seen_movie_ids: set[int],
    k: int,
) -> list[int]:
    unseen_scores = scores[~scores.index.isin(seen_movie_ids)]
    return unseen_scores.sort_values(ascending=False).head(k).index.astype(int).tolist()


def top_k_hybrid_candidates(
    cf_scores: pd.Series,
    content_scores: pd.Series,
    popularity_scores: pd.Series,
    seen_movie_ids: set[int],
    alpha: float,
    k: int,
    cf_top_n: int = 200,
    content_top_n: int = 200,
    popular_top_n: int = 50,
) -> list[int]:
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
    hybrid_scores = alpha * cf_norm + (1.0 - alpha) * content_norm
    return hybrid_scores.sort_values(ascending=False).head(k).index.astype(int).tolist()


def average_metrics(metrics: list[tuple[float, float, float, float]]) -> tuple[float, float, float, float]:
    if not metrics:
        return 0.0, 0.0, 0.0, 0.0
    metrics_arr = np.array(metrics)
    return tuple(metrics_arr.mean(axis=0))


def metric_summary(
    metrics: list[tuple[float, float, float, float]],
    random_state: int = 42,
    n_bootstrap: int = 1000,
) -> dict[str, float]:
    names = ["precision_at_10", "recall_at_10", "ndcg_at_10", "hit_rate_at_10"]
    if not metrics:
        summary = {}
        for name in names:
            summary[name] = 0.0
            summary[f"{name}_ci_low"] = 0.0
            summary[f"{name}_ci_high"] = 0.0
        return summary

    arr = np.array(metrics, dtype=float)
    rng = np.random.default_rng(random_state)
    summary = {}
    means = arr.mean(axis=0)
    for idx, name in enumerate(names):
        values = arr[:, idx]
        if len(values) < 2:
            ci_low = ci_high = float(means[idx])
        else:
            sample_idx = rng.integers(0, len(values), size=(n_bootstrap, len(values)))
            boot_means = values[sample_idx].mean(axis=1)
            ci_low, ci_high = np.percentile(boot_means, [2.5, 97.5])
        summary[name] = float(means[idx])
        summary[f"{name}_ci_low"] = float(ci_low)
        summary[f"{name}_ci_high"] = float(ci_high)
    return summary


def evaluate_all_models(
    ratings_df: pd.DataFrame,
    max_users: int = 50,
    k: int = 10,
    relevance_threshold: float = 4.0,
    random_state: int = 42,
    alphas: Sequence[float] = tuple(np.round(np.arange(0.0, 1.01, 0.1), 1)),
) -> pd.DataFrame:
    train_df, holdouts = chronological_user_holdouts(
        ratings_df=ratings_df,
        relevance_threshold=relevance_threshold,
        max_users=max_users,
        random_state=random_state,
    )
    features_df = build_eval_features(train_df)
    movie_ids = features_df["movieId"].astype(int).to_numpy()

    genre_matrix, genre_cols = build_content_matrix(features_df, full=False)
    full_matrix, full_cols = build_content_matrix(features_df, full=True)
    print(f"Evaluation users: {len(holdouts)}")
    print(f"Candidate movies: {len(movie_ids)}")
    print(f"Genre baseline features: {len(genre_cols)}")
    print(f"Content-FULL features: {len(full_cols)}")

    print("Training CF SVD on chronological training ratings...")
    algo = train_cf_svd(train_df, random_state=random_state)

    popularity_scores = pd.Series(
        features_df["avg_rating"].to_numpy() * np.log1p(features_df["rating_count"].to_numpy()),
        index=features_df["movieId"],
        name="popularity_score",
    )

    rng = np.random.default_rng(random_state)
    rows: list[Dict[str, float | int | str]] = []
    validation_by_alpha: Dict[float, list[tuple[float, float, float, float]]] = {
        float(alpha): [] for alpha in alphas
    }
    test_metrics: Dict[str, list[tuple[float, float, float, float]]] = {}

    def record_test(model: str, metrics: tuple[float, float, float, float]):
        test_metrics.setdefault(model, []).append(metrics)

    per_user_scores = []

    for holdout in holdouts:
        seen = set(holdout.train_ratings["movieId"].astype(int))

        random_scores = pd.Series(rng.random(len(movie_ids)), index=movie_ids)
        record_test(
            "Random",
            precision_recall_ndcg_at_k(
                top_k_from_scores(random_scores, seen, k),
                holdout.test_relevant,
                k,
            ),
        )

        record_test(
            "Popularity",
            precision_recall_ndcg_at_k(
                top_k_from_scores(popularity_scores, seen, k),
                holdout.test_relevant,
                k,
            ),
        )

        genre_scores = user_content_scores(
            holdout,
            features_df,
            genre_matrix,
            relevance_threshold=relevance_threshold,
        )
        record_test(
            "Genre-based",
            precision_recall_ndcg_at_k(
                top_k_from_scores(genre_scores, seen, k),
                holdout.test_relevant,
                k,
            ),
        )

        full_content_scores = user_content_scores(
            holdout,
            features_df,
            full_matrix,
            relevance_threshold=relevance_threshold,
        )
        record_test(
            "Content-FULL",
            precision_recall_ndcg_at_k(
                top_k_from_scores(full_content_scores, seen, k),
                holdout.test_relevant,
                k,
            ),
        )

        cf_scores = pd.Series(
            [algo.predict(holdout.user_id, int(movie_id)).est for movie_id in movie_ids],
            index=movie_ids,
            name="cf_score",
        )
        record_test(
            "CF SVD",
            precision_recall_ndcg_at_k(
                top_k_from_scores(cf_scores, seen, k),
                holdout.test_relevant,
                k,
            ),
        )

        per_user_scores.append((holdout, seen, cf_scores, full_content_scores))
        for alpha in alphas:
            alpha = float(alpha)
            validation_recs = top_k_hybrid_candidates(
                cf_scores=cf_scores,
                content_scores=full_content_scores,
                popularity_scores=popularity_scores,
                seen_movie_ids=seen,
                alpha=alpha,
                k=k,
            )
            validation_by_alpha[alpha].append(
                precision_recall_ndcg_at_k(
                    validation_recs,
                    holdout.validation_relevant,
                    k,
                )
            )

    alpha_summary = {
        alpha: metric_summary(metrics_list, random_state=random_state)
        for alpha, metrics_list in validation_by_alpha.items()
    }
    best_alpha = max(
        alpha_summary,
        key=lambda alpha: (
            alpha_summary[alpha]["ndcg_at_10"],
            alpha_summary[alpha]["recall_at_10"],
            alpha_summary[alpha]["precision_at_10"],
        ),
    )

    for holdout, seen, cf_scores, full_content_scores in per_user_scores:
        tuned_recs = top_k_hybrid_candidates(
            cf_scores=cf_scores,
            content_scores=full_content_scores,
            popularity_scores=popularity_scores,
            seen_movie_ids=seen,
            alpha=best_alpha,
            k=k,
        )
        record_test(
            "Hybrid tuned",
            precision_recall_ndcg_at_k(tuned_recs, holdout.test_relevant, k),
        )

        history_alpha = alpha_for_user_history(
            len(holdout.train_ratings),
            default_alpha=best_alpha,
        )
        history_recs = top_k_hybrid_candidates(
            cf_scores=cf_scores,
            content_scores=full_content_scores,
            popularity_scores=popularity_scores,
            seen_movie_ids=seen,
            alpha=history_alpha,
            k=k,
        )
        record_test(
            "Hybrid history-alpha",
            precision_recall_ndcg_at_k(history_recs, holdout.test_relevant, k),
        )

    for alpha, metrics in alpha_summary.items():
        rows.append(
            {
                "model": "Hybrid alpha validation",
                "alpha": alpha,
                "n_users": len(validation_by_alpha[alpha]),
                "evaluation_phase": "validation",
                "split_strategy": "chronological_validation_test_leave_recent_liked_out",
                "relevance_definition": f"validation/test rating >= {relevance_threshold}",
                "selected_alpha": best_alpha,
                **metrics,
            }
        )

    for model, metrics_list in test_metrics.items():
        metrics = metric_summary(metrics_list, random_state=random_state)
        rows.append(
            {
                "model": model,
                "alpha": best_alpha if model == "Hybrid tuned" else np.nan,
                "n_users": len(metrics_list),
                "evaluation_phase": "test",
                "split_strategy": "chronological_validation_test_leave_recent_liked_out",
                "relevance_definition": f"validation/test rating >= {relevance_threshold}",
                "selected_alpha": best_alpha if model.startswith("Hybrid") else np.nan,
                **metrics,
            }
        )

    results_df = pd.DataFrame(rows)
    order = {
        "Random": 0,
        "Popularity": 1,
        "Genre-based": 2,
        "CF SVD": 3,
        "Content-FULL": 4,
        "Hybrid tuned": 5,
        "Hybrid history-alpha": 6,
        "Hybrid alpha validation": 7,
    }
    results_df["model_order"] = results_df["model"].map(order)
    results_df = results_df.sort_values(["model_order", "alpha"]).drop(columns="model_order")
    return results_df.reset_index(drop=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate recommenders with chronological per-user holdout."
    )
    parser.add_argument("--n-rating-rows", type=int, default=2_000_000)
    parser.add_argument("--max-users", type=int, default=200)
    parser.add_argument("--k", type=int, default=10)
    parser.add_argument("--relevance-threshold", type=float, default=4.0)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument(
        "--alphas",
        type=float,
        nargs="+",
        default=[round(x, 1) for x in np.arange(0.0, 1.01, 0.1)],
        help="Hybrid CF weights to evaluate.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    ratings = load_ml32m_ratings_sample(n_rows=args.n_rating_rows)
    results = evaluate_all_models(
        ratings_df=ratings,
        max_users=args.max_users,
        k=args.k,
        relevance_threshold=args.relevance_threshold,
        random_state=args.random_state,
        alphas=args.alphas,
    )

    print("\n=== Proper ranking evaluation summary ===")
    print(results)

    out_path = PROCESSED_DATA_DIR / "model_comparison_metrics.csv"
    results.to_csv(out_path, index=False)
    print(f"\nSaved metrics to {out_path}")

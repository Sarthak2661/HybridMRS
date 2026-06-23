from __future__ import annotations
from typing import Dict, List, Set
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from src.content_model import build_content_matrices, recommend_content_for_user
from src.loaders import load_ml32m_ratings_sample
from src.config import PROCESSED_DATA_DIR


# metrics
def precision_at_k(recommended: List[int], relevant: Set[int]) -> float:
    if not recommended:
        return 0.0
    hits = len(set(recommended) & relevant)
    return hits / len(recommended)


def recall_at_k(recommended: List[int], relevant: Set[int]) -> float:
    if not relevant:
        return 0.0
    hits = len(set(recommended) & relevant)
    return hits / len(relevant)


def ndcg_at_k(recommended: List[int], relevant: Set[int]) -> float:
    if not recommended:
        return 0.0
    gains = [1.0 if mid in relevant else 0.0 for mid in recommended]
    dcg = sum(g / np.log2(i + 2) for i, g in enumerate(gains))
    ideal_gains = sorted(gains, reverse=True)
    idcg = sum(g / np.log2(i + 2) for i, g in enumerate(ideal_gains))
    return dcg / idcg if idcg > 0 else 0.0



def evaluate_content_method(
    method_name: str,
    movie_ids: np.ndarray,
    feature_matrix: np.ndarray,
    ratings_df: pd.DataFrame,
    user_ids: np.ndarray,
    top_k: int = 10,
    rel_threshold: float = 4.0,
):

    precs: List[float] = []
    recs: List[float] = []
    ndcgs: List[float] = []

    for uid in user_ids:
        user_ratings = ratings_df[ratings_df["userId"] == uid]
        relevant = set(
            user_ratings.loc[user_ratings["rating"] >= rel_threshold, "movieId"].tolist()
        )
        if len(relevant) == 0:
            # no relevant items for this user
            continue

        recs_list = recommend_content_for_user(
            user_id=int(uid),
            feature_matrix=feature_matrix,
            movie_ids=movie_ids,
            top_n=top_k,
            ratings_df=ratings_df,
            exclude_seen=False,
        )
        recommended = [mid for mid, _ in recs_list]

        precs.append(precision_at_k(recommended, relevant))
        recs.append(recall_at_k(recommended, relevant))
        ndcgs.append(ndcg_at_k(recommended, relevant))

    metrics = {
        "model": method_name,
        "precision_at_10": float(np.mean(precs)) if precs else 0.0,
        "recall_at_10": float(np.mean(recs)) if recs else 0.0,
        "ndcg_at_10": float(np.mean(ndcgs)) if ndcgs else 0.0,
        "n_users": int(len(precs)),
    }
    return metrics

# main method
if __name__ == "__main__":
    TOP_K = 10
    N_RATINGS = 1_000_000
    MIN_RATINGS_PER_USER = 10  # for evaluation

    print("Loading ratings sample for evaluation...")
    ratings_df = load_ml32m_ratings_sample(n_rows=N_RATINGS)

    # pick evaluation users with enough ratings
    counts = ratings_df.groupby("userId")["movieId"].count()
    candidate_users = counts[counts >= MIN_RATINGS_PER_USER].index.values
    rng = np.random.default_rng(42)
    eval_users = rng.choice(candidate_users, size=min(50, len(candidate_users)), replace=False)
    print(f"Evaluating on {len(eval_users)} users.")

    print("\nBuilding content matrices (FULL & K-BEST)...")
    movie_ids, X_full, X_kbest, kbest_mask, feature_names = build_content_matrices()

    metrics_list: List[Dict] = []

    # FULL matrix
    metrics_full = evaluate_content_method(
        method_name="Content-FULL",
        movie_ids=movie_ids,
        feature_matrix=X_full,
        ratings_df=ratings_df,
        user_ids=eval_users,
        top_k=TOP_K,
    )
    metrics_list.append(metrics_full)

    # K-BEST matrix
    metrics_kbest = evaluate_content_method(
        method_name="Content-KBEST",
        movie_ids=movie_ids,
        feature_matrix=X_kbest,
        ratings_df=ratings_df,
        user_ids=eval_users,
        top_k=TOP_K,
    )
    metrics_list.append(metrics_kbest)

    metrics_df = pd.DataFrame(metrics_list)
    print("\n=== Content model metrics (k=10) ===")
    print(metrics_df)

    best_row = metrics_df.sort_values("ndcg_at_10", ascending=False).iloc[0]
    print(f"\nBest content variant by NDCG@10: {best_row['model']}")

    # metrics save
    out_csv = PROCESSED_DATA_DIR / "content_model_metrics.csv"
    metrics_df.to_csv(out_csv, index=False)
    print(f"Saved metrics to {out_csv}")

    # plots
    fig, axes = plt.subplots(1, 3, figsize=(12, 4), sharex=True)
    x = np.arange(len(metrics_df))
    labels = metrics_df["model"].tolist()

    axes[0].bar(x, metrics_df["precision_at_10"])
    axes[0].set_title("Precision@10")
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(labels, rotation=20, ha="right")

    axes[1].bar(x, metrics_df["recall_at_10"])
    axes[1].set_title("Recall@10")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(labels, rotation=20, ha="right")

    axes[2].bar(x, metrics_df["ndcg_at_10"])
    axes[2].set_title("NDCG@10")
    axes[2].set_xticks(x)
    axes[2].set_xticklabels(labels, rotation=20, ha="right")

    fig.suptitle("Content Model: FULL vs K-BEST (k=10)", y=1.02)
    fig.tight_layout()

    figures_dir = PROCESSED_DATA_DIR.parent / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)
    fig_path = figures_dir / "content_model_metrics.png"
    plt.savefig(fig_path, dpi=150, bbox_inches="tight")
    plt.show()

    print(f"Saved plot to {fig_path}")

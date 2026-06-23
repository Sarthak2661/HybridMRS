import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
from src.cf_model import build_cf_model
from src.hybrid_model import (
    load_basic_features,
    build_content_matrix_kbest,
    recommend_hybrid,
)
from src.loaders import load_ml32m_ratings_sample

sns.set(style="whitegrid")


def evaluate_cf_vs_hybrid(user_id: int = 100, alpha: float = 0.6, top_n: int = 20):
    algo, trainset, testset, ratings_df = build_cf_model(
        n_rating_rows=8_000_000,
        test_size=0.2,
        random_state=42,
    )

    # Content matrices
    features_df, X_kbest, selected_cols, scaler = build_content_matrix_kbest(k_best=12)

    # Hybrid top-N
    rec_df = recommend_hybrid(
        user_id=user_id,
        algo=algo,
        ratings_df=ratings_df,
        features_df=features_df,
        X_kbest=X_kbest,
        alpha=alpha,
        top_n=top_n,
    )

    print(f"\nHybrid recommendations for user {user_id}:")
    print(rec_df)

    # Scatter plot: CF vs Hybrid scores
    plt.figure(figsize=(7, 5))
    sns.scatterplot(
        x="cf_score",
        y="hybrid_score",
        data=rec_df,
    )
    for _, row in rec_df.iterrows():
        plt.text(row["cf_score"], row["hybrid_score"], str(row["movieId"]), fontsize=8)

    plt.xlabel("CF score (SVD predicted rating)")
    plt.ylabel("Hybrid score")
    plt.title(f"CF vs Hybrid scores for user {user_id}")
    plt.tight_layout()
    plt.show()

    #Bar chart: hybrid vs cf (sorted by hybrid)
    sorted_df = rec_df.sort_values("hybrid_score", ascending=False)

    plt.figure(figsize=(10, 5))
    sns.barplot(
        x="title",
        y="hybrid_score",
        data=sorted_df,
        label="Hybrid",
    )
    plt.xticks(rotation=75, ha="right")
    plt.ylabel("Hybrid score")
    plt.title(f"Top-{top_n} Hybrid recommendation scores (user {user_id})")
    plt.tight_layout()
    plt.show()

    return rec_df


if __name__ == "__main__":
    evaluate_cf_vs_hybrid(user_id=100, alpha=0.6, top_n=10)

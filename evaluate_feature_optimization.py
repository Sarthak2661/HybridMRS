import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.metrics.pairwise import cosine_similarity

from src.hybrid_model import load_basic_features
from src.loaders import load_ml32m_ratings_sample

sns.set(style="whitegrid")


def build_content_matrices(k_best: int = 12):

    features_df = load_basic_features()

    base_cols = ["avg_rating", "rating_count", "popularity_score"]
    genre_cols = [c for c in features_df.columns if c.startswith("genre_")]
    content_cols = base_cols + genre_cols

    X = features_df[content_cols].fillna(0).astype(float)

    scaler = StandardScaler()
    X_full = scaler.fit_transform(X)

    y = features_df["avg_rating"].values

    selector = SelectKBest(score_func=f_regression, k=k_best)
    X_kbest = selector.fit_transform(X_full, y)
    selected_indices = selector.get_support(indices=True)
    selected_cols = [content_cols[i] for i in selected_indices]

    print(f"Content matrix (full): {X_full.shape}, k-best: {X_kbest.shape}")
    print(f"Selected features (k-best): {selected_cols}")

    return features_df, X_full, X_kbest, selected_cols


def user_profile_from_X(user_id, ratings_df, features_df, X_matrix):
    """
    Build a user profile vector as the mean of watched movie feature vectors.
    """
    user_ratings = ratings_df[ratings_df["userId"] == user_id]
    watched_ids = user_ratings["movieId"].unique()

    id_to_idx = {mid: idx for idx, mid in enumerate(features_df["movieId"].values)}
    watched_indices = [id_to_idx[mid] for mid in watched_ids if mid in id_to_idx]

    if not watched_indices:
        raise ValueError(f"User {user_id} has no overlap with features_df.")

    profile = X_matrix[watched_indices].mean(axis=0, keepdims=True)
    return profile


def top_n_content_recs(user_profile, X_matrix, features_df, n=10):
    sims = cosine_similarity(user_profile, X_matrix)[0]
    scores = pd.Series(sims, index=features_df["movieId"], name="content_score")
    # sort and join title
    top = scores.sort_values(ascending=False).head(n)
    out = pd.DataFrame({
        "movieId": top.index,
        "content_score": top.values,
    }).merge(features_df[["movieId", "title"]], on="movieId", how="left")
    return out


def evaluate_full_vs_kbest(
    n_users: int = 30,
    min_ratings_per_user: int = 20,
    k_best: int = 12,
):
    """
    For a sample of users, compute Jaccard overlap between
    top-10 content recommendations from FULL vs K-BEST features.
    Plot a histogram of overlaps.
    """
    # 1) Build matrices
    features_df, X_full, X_kbest, selected_cols = build_content_matrices(k_best=k_best)

    # 2) Sample ratings for user filtering
    ratings_df = load_ml32m_ratings_sample(n_rows=1_000_000)

    user_counts = ratings_df["userId"].value_counts()
    eligible_users = user_counts[user_counts >= min_ratings_per_user].index

    rng = np.random.default_rng(42)
    sampled_users = rng.choice(eligible_users, size=min(n_users, len(eligible_users)), replace=False)

    jaccards = []

    for uid in sampled_users:
        try:
            # Full profile & recs
            prof_full = user_profile_from_X(uid, ratings_df, features_df, X_full)
            rec_full = top_n_content_recs(prof_full, X_full, features_df, n=10)

            # K-best profile & recs
            prof_k = user_profile_from_X(uid, ratings_df, features_df, X_kbest)
            rec_k = top_n_content_recs(prof_k, X_kbest, features_df, n=10)

            set_full = set(rec_full["movieId"].tolist())
            set_k = set(rec_k["movieId"].tolist())

            inter = len(set_full & set_k)
            union = len(set_full | set_k)
            j = inter / union if union > 0 else 0.0
            jaccards.append(j)
        except ValueError as e:
            print(f"Skipping user {uid}: {e}")
            continue

    jaccards = np.array(jaccards)
    print(f"\nJaccard overlap stats over {len(jaccards)} users:")
    print(f"  mean  = {jaccards.mean():.3f}")
    print(f"  std   = {jaccards.std():.3f}")
    print(f"  min   = {jaccards.min():.3f}")
    print(f"  max   = {jaccards.max():.3f}")

    # Plot
    plt.figure(figsize=(8, 5))
    sns.histplot(jaccards, bins=10, kde=False)
    plt.xlabel("Jaccard overlap (Top-10 FULL vs K-BEST)")
    plt.ylabel("Number of users")
    plt.title("Effect of Feature Selection on Content-based Recommendations")
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    evaluate_full_vs_kbest(
        n_users=30,
        min_ratings_per_user=20,
        k_best=12,
    )

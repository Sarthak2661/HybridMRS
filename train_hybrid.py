from src.cf_model import build_cf_model
from src.hybrid_model import build_content_matrix_kbest, recommend_hybrid

if __name__ == "__main__":
    print("=== Training CF model (SVD) ===")
    algo, trainset, testset, ratings_df = build_cf_model(
        n_rating_rows=8_000_000,
        test_size=0.2,
        random_state=42,
    )

    print("=== Building content (k-best) matrix ===")
    features_df, X_kbest, selected_cols, scaler = build_content_matrix_kbest(
        k_best=12
    )

    user_id = 100

    print(f"\n=== HYBRID RECOMMENDATIONS for user {user_id} ===")
    rec_df = recommend_hybrid(
        user_id=user_id,
        algo=algo,
        ratings_df=ratings_df,
        features_df=features_df,
        X_kbest=X_kbest,
        alpha=0.6,
        top_n=10,
    )

    print(rec_df[["movieId", "title", "cf_score", "content_score", "hybrid_score"]])

from src.content_model import (
    build_content_matrices,
    recommend_content_for_user,
)
from src.loaders import load_ml32m_movies, load_ml32m_ratings_sample


if __name__ == "__main__":
    user_id = 100
    ratings_sample_n = 16_000_000

    # Build matrices
    movie_ids, X_full, X_kbest, kbest_mask, feature_names = build_content_matrices()

    #Load a ratings sample ONCE and reuse it
    ratings_df = load_ml32m_ratings_sample(n_rows=ratings_sample_n)

    # Recommendations using ALL features
    print("\n=== Content-based recommendations (FULL features) ===")
    recs_full = recommend_content_for_user(
        user_id=user_id,
        feature_matrix=X_full,
        movie_ids=movie_ids,
        top_n=10,
        ratings_df=ratings_df,
        exclude_seen=True,  # real “unseen” recommendations
    )

    # Recommendations using K-BEST features
    print("\n=== Content-based recommendations (K-BEST features) ===")
    recs_kbest = recommend_content_for_user(
        user_id=user_id,
        feature_matrix=X_kbest,
        movie_ids=movie_ids,
        top_n=10,
        ratings_df=ratings_df,
        exclude_seen=True,
    )

    movies_df = load_ml32m_movies().set_index("movieId")

    def show_recs(label, recs):
        print(f"\n{label}")
        for mid, score in recs:
            title = movies_df.loc[mid, "title"] if mid in movies_df.index else "<?>"
            print(f"{mid:7d} | {score: .4f} | {title}")

    show_recs("FULL FEATURES", recs_full)
    show_recs("K-BEST FEATURES", recs_kbest)

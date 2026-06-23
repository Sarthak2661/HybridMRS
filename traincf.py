from src.cf_model import build_cf_model, get_top_n
from src.loaders import load_ml32m_movies

if __name__ == "__main__":
    algo, trainset, testset, ratings_df = build_cf_model(
        n_rating_rows=8_000_000,
        test_size=0.2,
        random_state=42,
    )
    top_n = get_top_n(algo, ratings_df, user_id=100, n=10)

    # Join with titles
    movies_df = load_ml32m_movies()
    movies_map = movies_df.set_index("movieId")["title"].to_dict()

    print("\nTop 10 recommendations for User 100:")
    for mid, score in top_n:
        title = movies_map.get(mid, f"Movie {mid}")
        print(f"{mid:7d} | {score:.4f} | {title}")

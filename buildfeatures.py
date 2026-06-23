from src.features import build_basic_movie_features

if __name__ == "__main__":
    build_basic_movie_features(
        n_rating_rows=16_000_000,
        min_rating_count=20,
    )

from src.loaders import (
    load_ml32m_ratings_sample,
    load_ml32m_movies,
    load_genome_metadata_sample,
    #ensure_processed_dir,
)

if __name__ == "__main__":
    '''
    print("=== Checking directories ===")
    ensure_processed_dir()
    '''

    print("\n=== Testing MovieLens 32M ratings sample ===")
    ratings = load_ml32m_ratings_sample(n_rows=500_000)

    print("\n=== Testing MovieLens 32M movies ===")
    movies = load_ml32m_movies()

    print("\n=== Testing Genome 2021 metadata sample ===")
    meta = load_genome_metadata_sample(n_rows=5_000)

    print("\nShapes:")
    print(f"ratings: {ratings.shape}")
    print(f"movies:  {movies.shape}")
    print(f"meta:    {meta.shape}")

    print("\n✅ Data loading test completed.")

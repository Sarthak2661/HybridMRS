import numpy as np
import pandas as pd
from surprise import Dataset, Reader, SVD, accuracy
from surprise.model_selection import train_test_split
from src.loaders import load_ml32m_ratings_sample

def build_cf_model(
    n_rating_rows: int = 16_000_000,
    test_size: float = 0.2,
    random_state: int = 42,
):

    print(f"Loading {n_rating_rows} rating rows for CF model...")
    ratings_df = load_ml32m_ratings_sample(n_rows=n_rating_rows)

    reader = Reader(rating_scale=(ratings_df["rating"].min(), ratings_df["rating"].max()))
    data = Dataset.load_from_df(
        ratings_df[["userId", "movieId", "rating"]], reader
    )

    print("Converting to Surprise dataset...")
    trainset, testset = train_test_split(
        data, test_size=test_size, random_state=random_state
    )

    algo = SVD(random_state=random_state)
    print("Training SVD CF model...")
    algo.fit(trainset)

    print("Predicting testset...")
    predictions = algo.test(testset)
    rmse = accuracy.rmse(predictions, verbose=True)
    mae = accuracy.mae(predictions, verbose=True)

    print(f"\nCF Results: RMSE={rmse:.4f}, MAE={mae:.4f}\n")

    return algo, trainset, testset, ratings_df


def get_top_n(algo, ratings_df: pd.DataFrame, user_id: int, n: int = 10):

    all_movie_ids = ratings_df["movieId"].unique()

    # already rated movies
    watched = ratings_df.loc[ratings_df["userId"] == user_id, "movieId"].unique()

    # Candidates = not watched
    candidates = [mid for mid in all_movie_ids if mid not in watched]

    # Predict rating for each candidate
    preds = []
    for mid in candidates:
        est = algo.predict(user_id, mid).est
        preds.append((mid, est))

    # Sort & keep top n
    preds.sort(key=lambda x: x[1], reverse=True)
    return preds[:n]

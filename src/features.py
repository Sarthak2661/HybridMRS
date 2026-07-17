from __future__ import annotations
import re
from typing import Optional
import numpy as np
import pandas as pd
from sklearn.preprocessing import MultiLabelBinarizer
from src.loaders import (
    load_ml32m_ratings_sample,
    load_ml32m_movies,

)
from src.config import PROCESSED_DATA_DIR


def extract_year_from_title(title: str) -> Optional[int]:

    if not isinstance(title, str):
        return None

    # Look for "(YYYY)" anywhere in the string
    match = re.search(r"\((\d{4})\)", title)
    if not match:
        return None

    try:
        return int(match.group(1))
    except ValueError:
        return None


def normalize_genre_string(value: object) -> str:

    if not isinstance(value, str) or not value or value == "(no genres listed)":
        return ""
    return value


def build_basic_movie_features(
    n_rating_rows: int = 16_000_000,
    min_rating_count: int = 20,
) -> pd.DataFrame:


    # Load input data
    print(f"Loading ratings sample (n_rows={n_rating_rows}) ...")
    ratings = load_ml32m_ratings_sample(n_rows=n_rating_rows)

    print("Loading movies metadata ...")
    movies = load_ml32m_movies()

    # Aggregate ratings per movie
    print("Aggregating ratings per movie ...")
    movie_stats = (
        ratings.groupby("movieId")
        .agg(
            avg_rating=("rating", "mean"),
            rating_count=("rating", "count"),
            rating_std=("rating", "std"),
        )
        .reset_index()
    )


    movie_stats["rating_std"] = movie_stats["rating_std"].fillna(0.0)
    movie_stats["popularity_score"] = np.log1p(movie_stats["rating_count"])

    # Filter by minimum rating count
    print(f"Filtering movies with rating_count < {min_rating_count} ...")
    movie_stats = movie_stats[movie_stats["rating_count"] >= min_rating_count]

    # Merge in titles and raw genres
    print("Merging with movie titles and genres ...")
    df = movie_stats.merge(movies, on="movieId", how="left")

    # Extract release year from title
    print("Extracting year from title ...")
    df["year"] = df["title"].apply(extract_year_from_title).astype("float32")

    # 6) Process genre strings into lists
    print("Processing genres ...")
    df["genres"] = df["genres"].apply(normalize_genre_string)

    # Convert "Action|Comedy|..." -> ["Action", "Comedy", ...]
    df["genre_list"] = (
        df["genres"]
        .apply(lambda g: g.split("|") if g else [])
    )

    # how many genres does this movie have?
    df["num_genres"] = df["genre_list"].apply(len).astype("int32")

    # Multi-hot encode genres
    print("Encoding genres (multi-hot) ...")
    mlb = MultiLabelBinarizer()
    genre_matrix = mlb.fit_transform(df["genre_list"])
    genre_cols = [f"genre_{g}" for g in mlb.classes_]

    genre_df = pd.DataFrame(
        genre_matrix,
        columns=genre_cols,
        index=df.index,
    )


    print("Combining numeric and genre features ...")
    full_df = pd.concat(
        [
            df[
                [
                    "movieId",
                    "title",
                    "genres",
                    "genre_list",
                    "year",
                    "avg_rating",
                    "rating_count",
                    "popularity_score",
                    "num_genres",
                ]
            ],
            genre_df,
        ],
        axis=1,
    )


    full_df["movieId"] = full_df["movieId"].astype("int32")
    full_df["rating_count"] = full_df["rating_count"].astype("int32")
    full_df["avg_rating"] = full_df["avg_rating"].astype("float32")
    full_df["popularity_score"] = full_df["popularity_score"].astype("float32")


    output_path = PROCESSED_DATA_DIR / "ml32m_basic_movie_features.parquet"
    full_df.to_parquet(output_path, index=False)
    print(f"✅ Saved basic movie features to {output_path}")
    print(full_df.head())

    return full_df


def load_basic_movie_features() -> pd.DataFrame:
    path = PROCESSED_DATA_DIR / "ml32m_basic_movie_features.parquet"
    df = pd.read_parquet(path)
    print(f"Loaded basic movie features from {path}, shape={df.shape}")
    return df

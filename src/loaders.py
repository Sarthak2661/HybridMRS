import pandas as pd
from pathlib import Path
from typing import Optional

from src.config import (
    ML32M_RATINGS,
    ML32M_MOVIES,
    ML32M_TAGS,
    GENOME_METADATA_UPDATED,
    GENOME_TAGS,
    PROCESSED_DATA_DIR,
)

'''
def _check_exists(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"Expected file not found: {path}")
'''

# ---------- MovieLens 32M loaders ----------

def load_ml32m_ratings_sample(n_rows: Optional[int] = None) -> pd.DataFrame:
    print(f"Reading {('all' if n_rows is None else n_rows)} rows from {ML32M_RATINGS} ...")
    read_kwargs = {
        "dtype": {
            "userId": "int32",
            "movieId": "int32",
            "rating": "float32",
        }
    }
    if n_rows is not None:
        read_kwargs["nrows"] = n_rows

    df = pd.read_csv(ML32M_RATINGS, **read_kwargs)
    print(df.head())
    print(df.info(memory_usage="deep"))
    return df

def load_ml32m_movies() -> pd.DataFrame:
    print(f"Reading movies from {ML32M_MOVIES} ...")
    df = pd.read_csv(
        ML32M_MOVIES,
        dtype={"movieId": "int32", "title": "string", "genres": "string"}
    )
    print(df.head())
    return df

def load_ml32m_tags_sample(n_rows: Optional[int] = 500_000) -> pd.DataFrame:
    print(f"Reading up to {n_rows} rows from {ML32M_TAGS} ...")
    df = pd.read_csv(
        ML32M_TAGS,
        nrows=n_rows,
        dtype={"userId": "int32", "movieId": "int32", "tag": "string"}
    )
    print(df.head())
    return df


# ---------- Genome 2021 loaders ----------


def load_genome_metadata_sample(n_rows: Optional[int] = 10_000) -> pd.DataFrame:
    print(f"Reading first {n_rows} rows from {GENOME_METADATA_UPDATED} ...")
    df = pd.read_json(
        GENOME_METADATA_UPDATED,
        lines=True
    ).head(n_rows)
    print(df.head())
    return df


def load_genome_tags() -> pd.DataFrame:
    print(f"Reading genome tags from {GENOME_TAGS} ...")
    df = pd.read_json(
        GENOME_TAGS,
        lines=True
    )
    print(df.head())
    return df

'''
def ensure_processed_dir():
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Processed dir: {PROCESSED_DATA_DIR}")
'''


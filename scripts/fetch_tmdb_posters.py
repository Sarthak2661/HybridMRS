from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LINKS_CSV = PROJECT_ROOT / "data" / "raw" / "ml-32m" / "links.csv"
OUT_CSV = PROJECT_ROOT / "data" / "processed" / "movie_posters.csv"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


def fetch_movie(tmdb_id: int, api_key: str) -> dict | None:
    url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={api_key}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise


def build_poster_file(limit: int, sleep_seconds: float) -> pd.DataFrame:
    api_key = os.environ.get("TMDB_API_KEY")
    if not api_key:
        raise SystemExit("Set TMDB_API_KEY before running this script.")

    links = pd.read_csv(LINKS_CSV)
    links = links.dropna(subset=["tmdbId"]).copy()
    links["tmdbId"] = links["tmdbId"].astype(int)
    if limit:
        links = links.head(limit)

    rows = []
    for idx, row in enumerate(links.itertuples(index=False), start=1):
        movie = fetch_movie(int(row.tmdbId), api_key)
        if movie and movie.get("poster_path"):
            rows.append(
                {
                    "movieId": int(row.movieId),
                    "tmdbId": int(row.tmdbId),
                    "posterUrl": f"{TMDB_IMAGE_BASE}{movie['poster_path']}",
                    "source": "TMDB",
                }
            )
        if idx % 100 == 0:
            print(f"Processed {idx} movies, posters found={len(rows)}")
        if sleep_seconds:
            time.sleep(sleep_seconds)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    posters = pd.DataFrame(rows)
    posters.to_csv(OUT_CSV, index=False)
    return posters


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch real poster URLs from TMDB using MovieLens links.csv.")
    parser.add_argument("--limit", type=int, default=5000, help="Maximum linked movies to process. Use 0 for all.")
    parser.add_argument("--sleep", type=float, default=0.02, help="Delay between requests to be gentle with the API.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    posters_df = build_poster_file(limit=args.limit, sleep_seconds=args.sleep)
    print(f"Saved {len(posters_df)} poster URLs to {OUT_CSV}")

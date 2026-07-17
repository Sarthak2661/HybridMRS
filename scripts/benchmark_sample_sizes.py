from __future__ import annotations

import argparse
import time
from pathlib import Path

import pandas as pd

from src.config import PROCESSED_DATA_DIR
from src.evaluate_models import evaluate_all_models
from src.loaders import load_ml32m_ratings_sample


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the recommender evaluation at multiple user sample sizes."
    )
    parser.add_argument(
        "--sample-sizes",
        type=int,
        nargs="+",
        default=[100, 500, 1000],
        help="User counts to evaluate.",
    )
    parser.add_argument("--n-rating-rows", type=int, default=2_000_000)
    parser.add_argument("--k", type=int, default=10)
    parser.add_argument("--relevance-threshold", type=float, default=4.0)
    parser.add_argument("--random-state", type=int, default=42)
    return parser.parse_args()


def best_test_row(results: pd.DataFrame) -> pd.Series:
    test_rows = results[results["evaluation_phase"] == "test"].copy()
    if test_rows.empty:
        raise ValueError("No test rows found in evaluation results.")
    ranked = test_rows.sort_values(
        ["ndcg_at_10", "recall_at_10", "precision_at_10"],
        ascending=False,
    )
    return ranked.iloc[0]


def main() -> None:
    args = parse_args()
    ratings = load_ml32m_ratings_sample(n_rows=args.n_rating_rows)
    summary_rows: list[dict[str, object]] = []

    for sample_size in args.sample_sizes:
        started = time.perf_counter()
        results = evaluate_all_models(
            ratings_df=ratings,
            max_users=sample_size,
            k=args.k,
            relevance_threshold=args.relevance_threshold,
            random_state=args.random_state,
        )
        runtime_seconds = time.perf_counter() - started
        best = best_test_row(results)
        summary_rows.append(
            {
                "sample_size": int(sample_size),
                "best_model": str(best["model"]),
                "precision_at_10": float(best["precision_at_10"]),
                "recall_at_10": float(best["recall_at_10"]),
                "ndcg_at_10": float(best["ndcg_at_10"]),
                "hit_rate_at_10": float(best["hit_rate_at_10"]),
                "runtime_seconds": round(runtime_seconds, 2),
            }
        )
        print(
            f"Completed sample_size={sample_size} "
            f"best_model={best['model']} "
            f"ndcg_at_10={float(best['ndcg_at_10']):.4f} "
            f"runtime_seconds={runtime_seconds:.2f}"
        )

    output_path = PROCESSED_DATA_DIR / "evaluation_sample_size_summary.csv"
    pd.DataFrame(summary_rows).to_csv(output_path, index=False)
    print(f"Saved sample-size benchmark summary to {output_path}")


if __name__ == "__main__":
    main()

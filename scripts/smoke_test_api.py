from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.load(response)


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a lightweight smoke test against the running API.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Base URL for the running API")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    search_query = urllib.parse.urlencode({"query": "toy", "limit": 5})

    try:
        health = get_json(f"{base_url}/health")
        genres = get_json(f"{base_url}/genres")
        search = get_json(f"{base_url}/movies/search?{search_query}")
        metrics = get_json(f"{base_url}/metrics")
    except urllib.error.URLError as exc:
        print(f"Smoke test failed to reach the API at {base_url}: {exc}", file=sys.stderr)
        return 1

    try:
        assert_true(health.get("status") == "ok", "Expected /health to return status=ok")
        assert_true(isinstance(genres.get("genres"), list), "Expected /genres to return a genres list")
        assert_true(len(genres["genres"]) > 0, "Expected /genres to contain at least one genre")
        assert_true(isinstance(search.get("movies"), list), "Expected /movies/search to return a movies list")
        assert_true(isinstance(metrics, dict), "Expected /metrics to return a JSON object")
    except AssertionError as exc:
        print(f"Smoke test assertion failed: {exc}", file=sys.stderr)
        return 1

    summary = {
        "health": health,
        "genre_count": len(genres["genres"]),
        "search_result_count": len(search["movies"]),
        "metrics_keys": sorted(metrics.keys()),
    }
    print(json.dumps(summary, indent=2))
    print("API smoke test passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# Hybrid Movie Recommendation System

![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-frontend-61DAFB?logo=react&logoColor=0b1020)
![License](https://img.shields.io/badge/License-MIT-green.svg)

A hybrid movie recommender built on MovieLens 32M, with an offline evaluation pipeline and a small full-stack demo for exploring the results.

## Live demo

- Frontend: [https://hybrid-mv971m3l8-ssmind.vercel.app](https://hybrid-mv971m3l8-ssmind.vercel.app)
- Backend API: [https://hybridmrs.onrender.com](https://hybridmrs.onrender.com)
- Health check: [https://hybridmrs.onrender.com/health](https://hybridmrs.onrender.com/health)

## What this project includes

- Collaborative filtering baseline with Surprise SVD
- Content-based recommendation with engineered movie features
- Popularity, genre-based, and hybrid baselines for honest comparison
- Chronological per-user holdout evaluation with top-k ranking metrics
- Confidence intervals for Precision@10, Recall@10, NDCG@10, and Hit Rate@10
- FastAPI backend for search, recommend, feedback, and metrics
- React + Tailwind frontend with onboarding, recommendations, controls, dashboard, and methodology pages

## Prerequisites

Before running the project locally, make sure you have:

- Python `3.9+`
- Node.js `18+`
- `pnpm` or `npm` for the frontend

Optional:

- TMDB API key for expanded real poster coverage

## Project structure

```text
app/
  backend/    FastAPI recommendation API
  frontend/   React + Tailwind UI
data/
  processed/  metrics, poster metadata, engineered features
  raw/        MovieLens source files
src/          offline evaluation and feature engineering code
scripts/      utilities such as poster fetching
```

## Local setup

There are two dependency paths:

- `requirements-api.txt` for the deployable FastAPI app
- `requirements.txt` for the full project, including offline training, notebooks, charts, and evaluation scripts

### Quick start for the demo

Backend in one terminal:

```bash
pip install -r requirements-api.txt
python scripts/run_backend.py
```

Frontend in a second terminal:

```bash
cd app/frontend
pnpm install
pnpm dev
```

Open:

```text
http://localhost:5173
```

### Full project setup

If you want the offline training and evaluation pipeline too:

```bash
pip install -r requirements.txt
```

### Backend smoke test

After the backend is running, you can verify the core API endpoints with:

```bash
python scripts/smoke_test_api.py
```

That script checks:

- `/health`
- `/genres`
- `/movies/search`
- `/metrics`

### Why the API has a slim requirements file

The serving API does not need the full offline stack. In particular, `scikit-surprise`, notebooks, and plotting libraries are only needed for training and evaluation, not for the deployed FastAPI service. Keeping API dependencies separate makes local setup simpler and hosted deployment more reliable.

## Deployment

The simplest split for this project is:

- frontend on Vercel
- backend API on Render

That matches the current codebase well because the frontend is a Vite app and the backend is a standalone FastAPI service.

### Backend on Render

This repo now includes [render.yaml](render.yaml) for the API service.

Render expects Python web services to bind to `0.0.0.0` and the platform `PORT`, which is why the production start command uses:

```bash
uvicorn app.backend.main:app --host 0.0.0.0 --port $PORT
```

Recommended Render setup:

- Build command: `pip install -r requirements-api.txt`
- Start command: `uvicorn app.backend.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

The official Render docs for FastAPI and Python web services are here:

- [Deploy a FastAPI App](https://render.com/docs/deploy-fastapi)
- [Render Web Services](https://render.com/docs/web-services)
- [Setting Your Python Version](https://render.com/docs/python-version)

### Frontend on Vercel

The frontend can be deployed from `app/frontend`. This repo now includes [app/frontend/vercel.json](app/frontend/vercel.json) so Vercel recognizes the Vite app more explicitly.

Before deploying, set:

- `VITE_API_BASE=https://your-render-api-url.onrender.com`

Then deploy the frontend directory as a Vite project.

Official Vercel references:

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Deploying to Vercel](https://vercel.com/docs/deployments/overview)

### Production checklist

Before calling it deployed, make sure:

- the Render service returns `200` from `/health`
- `VITE_API_BASE` points to the live backend URL
- CORS in `app/backend/main.py` includes your frontend domain
- `data/processed/ml32m_basic_movie_features.parquet`
- `data/processed/model_comparison_metrics.csv`
- `data/processed/movie_posters.csv`

are committed and available in the deployed repo

### One practical note

The current `scripts/run_backend.py` is now flexible enough for both local and hosted use because it reads `HOST` and `PORT` from environment variables, but for Render the direct `uvicorn ... --host 0.0.0.0 --port $PORT` start command is still the clearest production setup.

## API overview

```text
GET  /movies/search?query=
GET  /genres
POST /recommend
POST /feedback
GET  /metrics
```

Example request:

```json
{
  "liked_movies": [1, 356, 4993, 7153],
  "alpha": 0.6,
  "novelty": 0.35,
  "top_k": 10
}
```

## Product flow

1. Movie onboarding: search, select, and rate movies, then choose up to 3 favorite genres.
2. Recommendations: view the top 10 movies with scores, explanations, and poster art.
3. Controls: adjust model balance, novelty, year range, genre filters, and watched exclusion.
4. Feedback loop: like, dislike, hide, mark watched, or ask for more like this.
5. Dashboard: inspect live-list metrics, offline benchmark results, alpha tuning, and model comparisons.

## Offline evaluation vs live demo

The project deliberately separates two things:

### Offline evaluator

The offline evaluation pipeline trains and compares:

- CF SVD
- Content-based
- Popularity
- Genre-based
- Hybrid recommenders

It uses chronological per-user holdout. Older ratings are treated as known history, future liked movies are hidden, and each model is scored on whether those hidden liked movies appear in the top 10.

Relevant item definition:

- test rating `>= 4.0`

The current saved benchmark uses `100` sampled users, so the dashboard shows confidence intervals and the results should be treated as a small-sample benchmark, not a production claim.

### Live interactive demo

The web demo uses a lightweight serving layer for fast local recommendations. It blends:

- content similarity
- rating-prior scoring
- novelty controls
- genre weighting
- negative feedback subtraction
- explanation tags

That keeps the demo fast without mixing it up with the offline benchmark.

## Real poster metadata

The backend uses real poster URLs when this file exists:

```text
data/processed/movie_posters.csv
```

Expected columns:

```text
movieId,tmdbId,posterUrl,source
```

To expand poster coverage:

```bash
set TMDB_API_KEY=your_key_here
python scripts/fetch_tmdb_posters.py --limit 5000
```

## Screenshots

**1. Landing Page**  
![Landing Page](resources/landing.png)

**2. Movie Selection**  
![Movie Selection](resources/movie_selection_landing.png)

**3. Selected Movies**  
![Selected Movies](resources/movie%20_selected.png)

**4. Recommendations**  
![Recommendations](resources/recommendations.png)

**5. Controls**  
![Controls](resources/controls.png)

**6. Dashboard**  
![Dashboard](resources/dashboard.png)

**7. Metrics**  
![Metrics](resources/metrics.png)

**8. Graphs**  
![Graphs](resources/graphs.png)

**9. Methodology**  
![Methodology](resources/Methodology.png)

## Data sources

Primary benchmark:

- MovieLens 32M

Recommended enrichments:

- TMDB for posters, release metadata, runtime, and overview text
- IMDb non-commercial datasets for title metadata validation
- MovieLens Tag Genome 2021 for richer explanation and similarity features

## Limitations and next steps

- expand offline evaluation beyond the current 100-user sample
- add persistent sessions with SQLite or PostgreSQL
- add a full model card covering biases, cold-start behavior, intended use, and non-goals
- containerize backend and frontend with Docker
- deploy the frontend and API to hosted services
- expand the content model from genre-first recommendations to a richer mixed profile using genres, tags, year, and rating priors first, then add cast/director similarity through TMDB or IMDb metadata enrichment
- add richer tag-genome explanations and approximate nearest-neighbor retrieval

## License

This project is available under the MIT License. See [LICENSE](LICENSE).


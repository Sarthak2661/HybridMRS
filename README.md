# Hybrid Movie Recommendation System (MovieLens 32M) — Version 1

This repository contains **Version 1** of a hybrid movie recommendation system built as a learning project for my MS in Computer Science (Data Science).

The goal is to explore, implement, and compare:

- **Collaborative Filtering (CF)** using Surprise SVD  
- **Content-based recommendation** using engineered movie features  
- A simple **hybrid model** that combines CF and content scores  
- Basic **feature selection** and **evaluation** using ranking metrics

The project uses a subset of the **MovieLens 32M** ratings and metadata.

---

## 1. Objectives

1. Load and inspect MovieLens data (`src/config.py`, `src/loaders.py`, `notebooks/eda.ipynb`).
2. Engineer intuitive movie-level features (`src/features.py`, `buildfeatures.py`).
3. Train:
   - A **CF baseline** (SVD on user–item ratings).
   - A **content-based model** using cosine similarity in feature space.
   - A **hybrid model** that linearly combines CF and content signals.
4. Evaluate models using:
   - **RMSE / MAE** on ratings (CF).
   - **Precision@10**, **Recall@10**, **NDCG@10** on top-K recommendations.
5. Study the effect of **feature selection (K-Best)** on content and hybrid performance.

Version 1 focuses on learning, experimentation, and clear code rather than deployment.

---

## Portfolio UI and API

The project now includes a portfolio-ready product demo:

```text
app/
  backend/    FastAPI recommendation API
  frontend/   React + Tailwind UI
```

Backend endpoints:

```text
GET  /movies/search?query=
GET  /genres
POST /recommend
POST /feedback
GET  /metrics
```

Example recommendation request:

```json
{
  "liked_movies": [1, 356, 4993, 7153],
  "alpha": 0.6,
  "novelty": 0.35,
  "top_k": 10
}
```

Example recommendation response:

```json
{
  "recommendations": [
    {
      "movieId": 5952,
      "title": "The Lord of the Rings: The Two Towers",
      "score": 0.91,
      "genres": ["Adventure", "Fantasy"],
      "reason": "Recommended because you liked similar movies. Similar genres: Adventure, Fantasy."
    }
  ]
}
```

UI flow:

1. Movie onboarding: search, select/rate movies, choose favorite genres.
2. Recommendations: top 10 movies with title, year, genres, score, poster placeholder, and explanation.
3. Controls: CF/content slider, novelty slider, genre filter, year filter, and watched exclusion.
4. Feedback loop: like, dislike, already watched, not interested, and more like this.
5. Dashboard: model comparison table, Precision@10, Recall@10, NDCG@10, alpha tuning, coverage, diversity, novelty, and serendipity.

Run the backend:

```bash
uvicorn app.backend.main:app --reload --port 8000
```

Run the frontend:

```bash
cd app/frontend
pnpm install   # or: npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

### Offline evaluation vs interactive serving

The **offline evaluation pipeline** trains and compares CF SVD, content-based,
popularity, genre-based, and hybrid recommenders using chronological per-user
holdout. It is the source of the model comparison metrics. The current saved
benchmark uses 100 sampled users, so the dashboard reports confidence intervals
and should be read as a credible portfolio benchmark rather than a production
claim about the full MovieLens population.

The **interactive web demo** uses a lightweight serving layer for fast local
recommendations. It combines content similarity, rating-prior scoring, novelty
controls, feedback actions, and explanation tags. This keeps the UI responsive
while keeping rigorous model comparison in the offline evaluator.

Metric labels in the UI are written for non-technical readers:

- **Top-10 Accuracy:** how many of the 10 recommendations were hidden liked movies.
- **Liked Movies Found:** how many hidden liked movies the recommender recovered.
- **Ranking Quality:** whether good matches appear near the top of the list.
- **Good Match Rate:** how often a user gets at least one good top-10 match.
- **Catalog Reach, Variety, Discovery, Surprise Match:** live-list quality metrics for the current recommendation list.

### Real poster metadata

The backend will use real poster URLs when this file exists:

```text
data/processed/movie_posters.csv
```

Expected columns:

```text
movieId,tmdbId,posterUrl,source
```

To build it from TMDB using the existing MovieLens `links.csv` mapping:

```bash
set TMDB_API_KEY=your_key_here
python scripts/fetch_tmdb_posters.py --limit 5000
```

The repository includes a small prepared `movie_posters.csv` for common demo
movies so the UI can show real poster art immediately. To expand coverage,
set `TMDB_API_KEY` and run the fetcher above. Without this file, the UI falls
back to generated poster placeholders.

### Limitations and next steps

The current application is a portfolio-ready local demo, not a production recommender service. Recommended next steps:

- Add persistent user sessions with SQLite/PostgreSQL so feedback and ratings can improve recommendations over time.
- Add a full model card covering data source, evaluation protocol, known biases, cold-start behavior, intended use, and non-goals.
- Containerize the backend and frontend with Docker for reproducible local setup.
- Deploy the frontend and API using hosted services such as Vercel plus Render, Railway, or Fly.io.
- Add real poster metadata via TMDB/OMDb or a prepared metadata file.
- Add tag-genome explanations, approximate nearest-neighbor retrieval, event logging, and saved model-artifact versioning.
- Add automated UI smoke tests for movie selection, recommendation generation, controls, dashboard, and methodology pages.
- Add a lightweight database-backed feedback loop so likes, dislikes, watched items, and more-like-this events can be replayed in evaluation.
- Add interactive UI tweaks to allow users to hot-swap and compare different backend recommendation models (including offline baselines) directly in the web app to see the difference between models.

### Screenshots

Here is a visual walkthrough of the product UI:

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

---

### Data source review

Current source:

- **MovieLens 32M** is a strong primary benchmark for this project because it is a stable research dataset with ratings, tags, movie metadata, and `links.csv` identifiers for IMDb/TMDB joins.

Recommended enrichments:

- **TMDB** for poster URLs, overview text, release dates, runtime, and visual polish.
- **IMDb non-commercial datasets** for frequently refreshed title metadata, release years, runtimes, genres, and external validation joins.
- **MovieLens Tag Genome 2021** for richer content features and better explanations such as mood, theme, and tag-profile similarity.

Keep MovieLens 32M as the evaluation backbone. Use TMDB/IMDb/Tag Genome as metadata enrichments rather than replacing the ratings benchmark.

---

## 2. Evaluation strategy

The main model comparison now uses a chronological per-user holdout in
`src/evaluate_models.py`.

For each evaluation user:

1. Sort ratings by `timestamp`.
2. Hide recent liked ratings for validation and test.
3. Train models only on that user's older ratings plus the rest of the training data.
4. Recommend top 10 unseen movies.
5. Tune hybrid `alpha` on validation items.
6. Report final performance on held-out test items.

Relevance is defined as:

```text
Relevant item = test-set movie with rating >= 4.0
```

The comparison includes:

- Random recommender
- Popularity recommender
- Genre-based recommender
- CF SVD
- Content-FULL
- Hybrid tuned across `alpha = 0.0, 0.1, ..., 1.0`
- Hybrid history-alpha, which shifts toward content for low-history users and CF for high-history users

The hybrid model builds a candidate pool before reranking:

```text
Top 200 CF candidates
+ Top 200 content candidates
+ Top 50 popular candidates
= hybrid candidate pool
```

CF and content scores are normalized within each user's candidate pool before applying:

```text
hybrid_score = alpha * cf_norm + (1 - alpha) * content_norm
```

Run:

```bash
python -m src.evaluate_models --n-rating-rows 1000000 --max-users 100 --k 10
```

Results are saved to:

```text
data/processed/model_comparison_metrics.csv
```

The current evaluator reports bootstrap 95% confidence intervals for:

- Precision@10
- Recall@10
- NDCG@10
- Hit Rate@10

---

## 3. Model card draft

**Data source:** MovieLens 32M ratings and metadata from GroupLens, with optional
TMDB/OMDb poster metadata joined through MovieLens `links.csv`.

**Evaluation protocol:** chronological per-user holdout. Older user ratings are
used for training; recent liked items are split into validation/test relevance.

**Models compared:** Random, Popularity, Genre-based, CF SVD, Content-FULL,
Hybrid tuned, and Hybrid history-alpha.

**Known biases:** MovieLens users are not representative of all movie viewers;
popular films receive more ratings; older catalog items may have sparse or noisy
metadata; genre-only content features are limited.

**Cold-start behavior:** New users rely more on selected/rated movies, favorite
genres, content similarity, and popularity priors. More ratings should allow
stronger collaborative filtering.

**Intended use:** educational and portfolio recommender-system demonstration,
not production entertainment personalization.

---

## 4. Data layout

Expected layout (configured in `src/config.py`):

```text
data/
  raw/
    ml-32m/
      ratings.csv
      movies.csv
      tags.csv
      links.csv
    genome_2021/
      metadata.json
      metadata_updated.json
      ratings.json
      reviews.json
      survey_answers.json
      tag_count.json
      tags.json
  processed/
    ml32m_basic_movie_features.parquet
    content_model_metrics.csv
    model_comparison_metrics.csv

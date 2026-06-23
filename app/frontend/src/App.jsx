import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  EyeOff,
  Film,
  Gauge,
  GitBranch,
  Heart,
  Info,
  Layers3,
  Play,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  X
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  fetchGenres,
  fetchMetrics,
  fetchRecommendations,
  searchMovies,
  sendFeedback
} from "./api";

const tabs = [
  { id: "home", label: "Home", icon: Film },
  { id: "onboarding", label: "Movie Selection", icon: Search },
  { id: "recommendations", label: "Recommendations", icon: Sparkles },
  { id: "controls", label: "Controls", icon: SlidersHorizontal },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "about", label: "Methodology", icon: Info }
];

const feedbackActions = [
  { action: "like", label: "Like", icon: ThumbsUp },
  { action: "dislike", label: "Dislike", icon: ThumbsDown },
  { action: "already_watched", label: "Watched", icon: Check },
  { action: "not_interested", label: "Hide", icon: EyeOff },
  { action: "more_like_this", label: "More", icon: Heart }
];

const METRIC_INFO = {
  precision_at_10: {
    label: "Top-10 Accuracy",
    technical: "Precision@10",
    help: "Of the 10 movies recommended, how many were hidden movies the user later liked.",
    percent: true
  },
  recall_at_10: {
    label: "Liked Movies Found",
    technical: "Recall@10",
    help: "Of the hidden future-liked movies, how many the model managed to find in the top 10.",
    percent: true
  },
  ndcg_at_10: {
    label: "Ranking Quality",
    technical: "NDCG@10",
    help: "Rewards putting good matches near the top of the recommendation list.",
    percent: true
  },
  hit_rate_at_10: {
    label: "Good Match Rate",
    technical: "Hit Rate@10",
    help: "Percent of evaluated users who received at least one good match in their top 10.",
    percent: true
  },
  coverage: {
    label: "Catalog Reach",
    technical: "Coverage",
    help: "How much of the full movie catalog appears in this current top-10 list.",
    percent: true
  },
  diversity: {
    label: "Variety",
    technical: "Diversity",
    help: "How different the recommended movies are from each other by genre.",
    percent: true
  },
  novelty: {
    label: "Discovery",
    technical: "Novelty",
    help: "How much the list avoids only showing obvious, very popular movies.",
    percent: true
  },
  serendipity: {
    label: "Surprise Match",
    technical: "Serendipity",
    help: "A simple estimate of surprising recommendations that still match the user profile.",
    percent: true
  },
  alpha: {
    label: "Model Balance",
    technical: "Alpha",
    help: "Controls the blend between content similarity and collaborative/rating-prior signals.",
    percent: false
  }
};

function extractYear(title) {
  const match = title?.match(/\((\d{4})\)/);
  return match ? Number(match[1]) : null;
}

function formatMetricValue(key, value) {
  const numeric = Number(value ?? 0);
  if (METRIC_INFO[key]?.percent) {
    const digits = key === "coverage" ? 3 : 1;
    return `${(numeric * 100).toFixed(digits)}%`;
  }
  return numeric.toFixed(2);
}

function formatCi(metricKey, row) {
  const low = row[`${metricKey}_ci_low`];
  const high = row[`${metricKey}_ci_high`];
  if (low === undefined || high === undefined || low === "" || high === "") return "-";
  return `${METRIC_INFO[metricKey].technical}: ${formatMetricValue(metricKey, row[metricKey])} ± CI [${formatMetricValue(metricKey, low)}, ${formatMetricValue(metricKey, high)}]`;
}

function chartMetricTooltip(value, name, item) {
  const key = item?.dataKey ?? name;
  return [formatMetricValue(key, value), METRIC_INFO[key]?.label ?? name];
}

function shortModelName(name = "") {
  return name
    .replace("Hybrid (CF + Content)", "Hybrid")
    .replace("Content (k-best)", "Content")
    .replace("CF (SVD)", "CF SVD")
    .replace("Hybrid history-alpha", "History alpha")
    .replace("Hybrid tuned", "Hybrid tuned");
}

function metricPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [genres, setGenres] = useState([]);
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  const [genreFilter, setGenreFilter] = useState([]);
  const [alpha, setAlpha] = useState(0.6);
  const [novelty, setNovelty] = useState(0.35);
  const [yearMin, setYearMin] = useState(1980);
  const [yearMax, setYearMax] = useState(2025);
  const [excludeWatched, setExcludeWatched] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [catalogMetrics, setCatalogMetrics] = useState({});
  const [feedback, setFeedback] = useState({});
  const [metrics, setMetrics] = useState({ rows: [], summary: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchGenres().then((data) => setGenres(data.genres ?? [])).catch(() => setGenres([]));
    fetchMetrics().then(setMetrics).catch(() => setMetrics({ rows: [], summary: "Metrics are not available yet." }));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      searchMovies(query, favoriteGenres, favoriteGenres.length ? 20 : 12)
        .then((data) => setSearchResults(data.movies ?? []))
        .catch(() => setSearchResults([]));
    }, 180);
    return () => clearTimeout(handle);
  }, [query, favoriteGenres]);

  const ratedMovies = useMemo(
    () => selected.map((movie) => ({ movieId: movie.movieId, rating: movie.rating })),
    [selected]
  );

  const requestPayload = {
    liked_movies: selected.filter((movie) => movie.rating >= 4).map((movie) => movie.movieId),
    rated_movies: ratedMovies,
    favorite_genres: favoriteGenres,
    alpha,
    novelty,
    top_k: 10,
    genre_filter: genreFilter,
    year_min: yearMin,
    year_max: yearMax,
    exclude_watched: excludeWatched,
    feedback
  };

  async function refreshRecommendations(nextFeedback = feedback) {
    setStatus("Updating recommendations...");
    const payload = { ...requestPayload, feedback: nextFeedback };
    try {
      const data = await fetchRecommendations(payload);
      setRecommendations(data.recommendations ?? []);
      setCatalogMetrics(data.catalog_metrics ?? {});
      setActiveTab("recommendations");
      setStatus("");
    } catch (error) {
      setStatus("Backend is not running. Start FastAPI on port 8000.");
    }
  }

  function addMovie(movie) {
    setSelected((current) => {
      if (current.some((item) => item.movieId === movie.movieId)) return current;
      return [...current, { ...movie, rating: 5, year: movie.year ?? extractYear(movie.title) }].slice(0, 10);
    });
  }

  function updateRating(movieId, rating) {
    setSelected((current) => current.map((movie) => (movie.movieId === movieId ? { ...movie, rating } : movie)));
  }

  function removeMovie(movieId) {
    setSelected((current) => current.filter((movie) => movie.movieId !== movieId));
  }

  function toggleListValue(value, values, setter) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function toggleFavoriteGenre(genre) {
    setFavoriteGenres((current) => {
      if (current.includes(genre)) return current.filter((item) => item !== genre);
      if (current.length >= 3) return current;
      return [...current, genre];
    });
  }

  async function handleFeedback(movieId, action) {
    const nextFeedback = { ...feedback, [movieId]: action };
    setFeedback(nextFeedback);
    await sendFeedback({ movieId, action, session_id: "demo" }).catch(() => null);
    await refreshRecommendations(nextFeedback);
  }

  const chartRows = metrics.rows ?? [];
  const testRows = chartRows
    .filter((row) => !row.evaluation_phase || row.evaluation_phase === "test")
    .map((row) => ({ ...row, displayModel: shortModelName(row.model) }));
  const alphaRows = chartRows
    .filter((row) => row.model === "Hybrid alpha validation" || (row.model || "").includes("Hybrid"))
    .filter((row) => row.alpha !== "" && row.alpha !== null && row.alpha !== undefined)
    .map((row) => ({ ...row, alpha: Number(row.alpha) }))
    .sort((a, b) => a.alpha - b.alpha);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-ink">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/85 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">Hybrid MRS</p>
            <h1 className="text-2xl font-semibold">Movie intelligence platform</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`focus-ring inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm ${
                    activeTab === tab.id
                      ? "border-moss bg-moss text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-moss"
                  }`}
                  title={tab.label}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className={`mx-auto grid max-w-7xl gap-6 px-4 py-6 ${["home", "dashboard", "about"].includes(activeTab) ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <section className="min-w-0">
          {activeTab === "home" && (
            <Home
              setActiveTab={setActiveTab}
              metrics={metrics}
              selectedCount={selected.length}
            />
          )}

          {activeTab === "onboarding" && (
            <Onboarding
              query={query}
              setQuery={setQuery}
              searchResults={searchResults}
              selected={selected}
              addMovie={addMovie}
              updateRating={updateRating}
              removeMovie={removeMovie}
              genres={genres}
              favoriteGenres={favoriteGenres}
              toggleGenre={toggleFavoriteGenre}
              refreshRecommendations={refreshRecommendations}
            />
          )}

          {activeTab === "recommendations" && (
            <Recommendations
              recommendations={recommendations}
              selectedCount={selected.length}
              onFeedback={handleFeedback}
              onRefresh={() => refreshRecommendations()}
              status={status}
            />
          )}

          {activeTab === "controls" && (
            <Controls
              alpha={alpha}
              setAlpha={setAlpha}
              novelty={novelty}
              setNovelty={setNovelty}
              genres={genres}
              genreFilter={genreFilter}
              toggleGenre={(genre) => toggleListValue(genre, genreFilter, setGenreFilter)}
              yearMin={yearMin}
              setYearMin={setYearMin}
              yearMax={yearMax}
              setYearMax={setYearMax}
              excludeWatched={excludeWatched}
              setExcludeWatched={setExcludeWatched}
              refreshRecommendations={refreshRecommendations}
            />
          )}

          {activeTab === "dashboard" && (
            <Dashboard metrics={metrics} testRows={testRows} alphaRows={alphaRows} catalogMetrics={catalogMetrics} />
          )}

          {activeTab === "about" && <About />}
        </section>

        {!["home", "dashboard", "about"].includes(activeTab) && (
          <aside className="space-y-4">
            <SummaryPanel selected={selected} alpha={alpha} novelty={novelty} catalogMetrics={catalogMetrics} status={status} />
          </aside>
        )}
      </div>
    </main>
  );
}

function Home({ setActiveTab, metrics, selectedCount }) {
  const rows = metrics.rows ?? [];
  const best = rows
    .filter((row) => !row.evaluation_phase || row.evaluation_phase === "test")
    .sort((a, b) => Number(b.ndcg_at_10 || 0) - Number(a.ndcg_at_10 || 0))[0];

  return (
    <div className="space-y-8">
      <section className="hero-cinema overflow-hidden rounded-lg">
        <div className="hero-overlay px-5 py-10 md:px-10 md:py-16">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_420px]">
            <div className="max-w-3xl text-white">
              <div className="reveal inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-sm backdrop-blur">
                <ShieldCheck size={16} />
                Evaluation-first recommender system
              </div>
              <h2 className="reveal mt-5 text-4xl font-semibold leading-tight md:text-6xl">
                Personalized movie discovery with transparent model signals.
              </h2>
              <p className="reveal mt-5 max-w-2xl text-base leading-7 text-white/85 md:text-lg">
                Rate films, tune collaborative versus content signals, inspect explanations, and compare model metrics without hiding weak results.
              </p>
              <div className="reveal mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab("onboarding")}
                  className="focus-ring inline-flex h-12 items-center gap-2 rounded-md bg-coral px-5 font-semibold text-white shadow-lg shadow-coral/30 transition hover:-translate-y-0.5"
                >
                  <Play size={18} />
                  Start recommending
                </button>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className="focus-ring inline-flex h-12 items-center gap-2 rounded-md border border-white/40 bg-white/10 px-5 font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  View metrics
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            <div className="floating-panel rounded-lg border border-white/20 bg-white/15 p-4 text-white shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Live ranking recipe</p>
                <Sparkles size={18} className="text-saffron" />
              </div>
              <div className="mt-4 space-y-3">
                <SignalRow label="Collaborative filtering" value={72} />
                <SignalRow label="Content similarity" value={84} />
                <SignalRow label="Novelty boost" value={41} />
              </div>
              <div className="poster-rail mt-5">
                {["Sci-Fi", "Drama", "Adventure", "Comedy"].map((label, index) => (
                  <div key={label} className="mini-poster" style={{ animationDelay: `${index * 0.18}s` }}>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <HomeStat icon={Film} label="Catalog-aware" value="MovieLens" />
        <HomeStat icon={Layers3} label="Hybrid candidate pool" value="CF + Content + Popular" />
        <HomeStat icon={Gauge} label="Best recorded model" value={best?.model ?? "Run metrics"} />
        <HomeStat icon={ShieldCheck} label="Selected movies" value={String(selectedCount)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {[
          ["1", "Onboard taste", "Search, rate movies, and choose favorite genres to build a session profile."],
          ["2", "Tune the model", "Adjust alpha, novelty, genre filters, year range, and watched exclusion."],
          ["3", "Inspect evidence", "Read explanations and compare Precision@10, Recall@10, NDCG@10, diversity, and novelty."]
        ].map(([step, title, copy]) => (
          <article key={step} className="lift-card rounded-lg border border-slate-200 bg-white p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-moss text-sm font-semibold text-white">{step}</span>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function SignalRow({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
        <div className="signal-fill h-full rounded-full bg-saffron" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function HomeStat({ icon: Icon, label, value }) {
  return (
    <div className="lift-card rounded-lg border border-slate-200 bg-white p-4">
      <Icon size={20} className="text-moss" />
      <p className="mt-3 text-sm text-slate-600">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Onboarding({
  query,
  setQuery,
  searchResults,
  selected,
  addMovie,
  updateRating,
  removeMovie,
  genres,
  favoriteGenres,
  toggleGenre,
  refreshRecommendations
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Step 1</p>
        <h2 className="mt-1 text-2xl font-semibold">Build your taste profile</h2>
        <p className="mt-1 text-sm text-slate-600">Pick up to 3 favorite genres to refresh the movie pool, then rate 10 movies you know.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="soft-panel rounded-lg p-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Search movie by title</span>
            <div className="mt-2 flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3">
              <Search size={18} className="text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Toy Story, Inception, The Matrix..."
                className="w-full bg-transparent outline-none"
              />
            </div>
          </label>
          <div className="mt-3 rounded-md bg-mist px-3 py-2 text-sm text-slate-700">
            {favoriteGenres.length
              ? `Showing up to 20 highly rated movies matching: ${favoriteGenres.join(", ")}.`
              : "Showing popular starter movies. Select genres below to refresh this list."}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {searchResults.map((movie) => (
              <button
                key={movie.movieId}
                onClick={() => addMovie(movie)}
                className="focus-ring lift-card flex min-h-24 items-start gap-3 rounded-md border border-slate-200 bg-white p-3 text-left"
              >
                <img src={movie.posterUrl} alt="" className="h-20 w-14 rounded object-cover" />
                <span>
                  <span className="block font-medium">{movie.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{movie.genres.join(", ") || "Genres unavailable"}</span>
                </span>
              </button>
            ))}
            {searchResults.length === 0 && (
              <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 md:col-span-2">
                No movies found for the current search and genre combination.
              </div>
            )}
          </div>
        </div>

        <div className="soft-panel rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Selected movies</h3>
            <span className="rounded-md bg-mist px-2 py-1 text-sm font-semibold text-moss">{selected.length}/10 target</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${Math.min(selected.length / 10, 1) * 100}%` }} />
          </div>
          <div className="mt-3 space-y-3">
            {selected.map((movie) => (
              <div key={movie.movieId} className="lift-card rounded-md border border-slate-100 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{movie.title}</p>
                    <p className="text-xs text-slate-500">{movie.genres?.join(", ")}</p>
                  </div>
                  <button onClick={() => removeMovie(movie.movieId)} className="focus-ring rounded p-1 text-slate-500 hover:text-coral" title="Remove">
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => updateRating(movie.movieId, rating)}
                      className="focus-ring rounded p-1 text-saffron"
                      title={`${rating} stars`}
                    >
                      <Star size={17} fill={movie.rating >= rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {selected.length === 0 && <p className="text-sm text-slate-600">Pick a few movies to start the demo.</p>}
          </div>
          <button
            onClick={() => refreshRecommendations()}
            disabled={selected.length === 0}
            className="focus-ring mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-coral px-4 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Sparkles size={18} />
            Generate recommendations
          </button>
        </div>
      </div>

      <GenrePicker genres={genres} selected={favoriteGenres} toggleGenre={toggleGenre} title="Favorite genres" maxSelected={3} />
    </div>
  );
}

function Recommendations({ recommendations, selectedCount, onFeedback, onRefresh, status }) {
  if (!recommendations.length) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-8">
        <h2 className="text-xl font-semibold">Recommendations</h2>
        <p className="mt-2 text-slate-600">Select movies first, then generate recommendations.</p>
        <button onClick={onRefresh} disabled={selectedCount === 0} className="focus-ring mt-4 rounded-md bg-moss px-4 py-2 font-medium text-white disabled:bg-slate-300">
          Generate
        </button>
        {status && <p className="mt-3 text-sm text-coral">{status}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">Step 2</p>
          <h2 className="mt-1 text-2xl font-semibold">Top 10 recommendations</h2>
          <p className="mt-1 text-sm text-slate-600">Each result includes score components and a plain-English explanation.</p>
        </div>
        <button onClick={onRefresh} className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-moss px-3 text-moss">
          <Sparkles size={16} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {recommendations.map((movie, index) => (
          <article key={movie.movieId} className="lift-card rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-moss px-3 py-1 text-xs font-semibold text-white">Rank #{index + 1}</span>
              <span className="rounded-md bg-mist px-2 py-1 text-sm font-semibold">{movie.score.toFixed(2)}</span>
            </div>
            <div className="flex gap-4">
              <img src={movie.posterUrl} alt="" className="h-36 w-24 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold leading-snug">{movie.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{movie.year || "Year unknown"} · {movie.genres.join(", ")}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-700">{movie.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {movie.explanation_tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600">
              <MetricChip label="CF" value={movie.cf_score} max={5} />
              <MetricChip label="Content" value={movie.content_score} max={1.5} />
              <MetricChip label="Novelty" value={movie.novelty_score} max={1} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {feedbackActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.action}
                    onClick={() => onFeedback(movie.movieId, item.action)}
                    className="focus-ring inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 px-2 text-sm hover:border-moss"
                    title={item.label}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Controls({
  alpha,
  setAlpha,
  novelty,
  setNovelty,
  genres,
  genreFilter,
  toggleGenre,
  yearMin,
  setYearMin,
  yearMax,
  setYearMax,
  excludeWatched,
  setExcludeWatched,
  refreshRecommendations
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Step 3</p>
        <h2 className="mt-1 text-2xl font-semibold">Recommendation controls</h2>
        <p className="mt-1 text-sm text-slate-600">Adjust the ranking logic and regenerate results.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ControlSlider
          label={METRIC_INFO.alpha.label}
          left="Content"
          right="CF / rating prior"
          value={alpha}
          setValue={setAlpha}
          help={METRIC_INFO.alpha.help}
        />
        <ControlSlider
          label={METRIC_INFO.novelty.label}
          left="Popular"
          right="More discovery"
          value={novelty}
          setValue={setNovelty}
          help={METRIC_INFO.novelty.help}
        />
      </div>

      <div className="soft-panel rounded-lg p-4">
        <h3 className="font-semibold">Year preference</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-600">From</span>
            <input type="number" value={yearMin} onChange={(event) => setYearMin(Number(event.target.value))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">To</span>
            <input type="number" value={yearMax} onChange={(event) => setYearMax(Number(event.target.value))} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3" />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={excludeWatched} onChange={(event) => setExcludeWatched(event.target.checked)} className="h-4 w-4 accent-moss" />
          Exclude already watched or selected movies
        </label>
      </div>

      <GenrePicker genres={genres} selected={genreFilter} toggleGenre={toggleGenre} title="Genre filter" />

      <button onClick={() => refreshRecommendations()} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-moss px-4 font-medium text-white">
        <Settings2 size={18} />
        Apply controls
      </button>
    </div>
  );
}

function Dashboard({ metrics, testRows, alphaRows, catalogMetrics }) {
  const bestRow = [...testRows].sort((a, b) => Number(b.ndcg_at_10 || 0) - Number(a.ndcg_at_10 || 0))[0];
  const modelCount = new Set(testRows.map((row) => row.model)).size;
  const benchmarkUsers = Math.max(...testRows.map((row) => Number(row.n_users || 0)), 0);
  const liveMetricKeys = ["coverage", "diversity", "novelty", "serendipity"];
  const offlineMetricKeys = ["precision_at_10", "recall_at_10", "ndcg_at_10", "hit_rate_at_10"];
  const hasLiveMetrics = Object.keys(catalogMetrics).length > 0;
  const metricCards = liveMetricKeys.map((key) => ({
    key,
    ...METRIC_INFO[key],
    value: hasLiveMetrics ? formatMetricValue(key, catalogMetrics[key]) : "—"
  }));

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">Evaluation</p>
            <h2 className="mt-1 text-3xl font-semibold">Model comparison dashboard</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Offline metrics are calculated on hidden future-liked movies. Live demo metrics describe the current recommendation list.
            </p>
          </div>
          <div className="rounded-md bg-mist px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-600">Best recorded model</p>
            <p className="mt-1 text-lg font-semibold text-moss">{bestRow?.model ?? "Run evaluation"}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Current offline benchmark uses {benchmarkUsers || "the saved sample of"} users, so confidence intervals matter.
            </p>
          </div>
        </div>
        {metrics.notice && (
          <div className="mt-5 rounded-md border border-saffron/40 bg-saffron/10 p-4 text-sm leading-6 text-slate-800">
            <p className="font-semibold">Metrics status</p>
            <p className="mt-1">{metrics.notice}</p>
          </div>
        )}
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">This Recommendation List</p>
          <h3 className="mt-1 text-2xl font-semibold">Live session metrics</h3>
          <p className="mt-1 text-sm text-slate-600">
            These scores describe the top-10 list generated from your current movie choices and controls.
          </p>
        </div>
        {!hasLiveMetrics && (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            <span className="font-medium text-slate-700">No recommendations generated yet.</span>{" "}
            Go to <span className="font-medium">Movie Selection</span> → pick movies → click <span className="font-medium">Generate recommendations</span> to populate these metrics.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <MetricCard key={card.key} title={card.label} value={card.value} technical={card.technical} help={card.help} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">Offline Model Benchmark</p>
          <h3 className="mt-1 text-2xl font-semibold">Hidden future-liked movie evaluation</h3>
          <p className="mt-1 text-sm text-slate-600">
            These charts come from <span className="font-medium">model_comparison_metrics.csv</span> and compare models on held-out user behavior.
            The current saved run evaluates {benchmarkUsers || "a sampled set of"} users, not the full MovieLens population.
          </p>
        </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <ChartPanel
          title="Offline model benchmark"
          subtitle={`${modelCount || 0} test models, ${benchmarkUsers || "sampled"} users, from data/processed/model_comparison_metrics.csv`}
        >
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={testRows} margin={{ top: 20, right: 20, left: 10, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="displayModel" interval={0} angle={-25} textAnchor="end" height={90} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatMetricValue("ndcg_at_10", value)} />
              <Tooltip formatter={chartMetricTooltip} />
              <Legend />
              <Bar dataKey="precision_at_10" name={METRIC_INFO.precision_at_10.label} fill="#3f6f5f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recall_at_10" name={METRIC_INFO.recall_at_10.label} fill="#c95f4a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ndcg_at_10" name={METRIC_INFO.ndcg_at_10.label} fill="#d9a441" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className="grid gap-5">
          <div className="soft-panel rounded-lg p-5">
            <h3 className="text-lg font-semibold">How to read this</h3>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
              {offlineMetricKeys.map((key) => (
                <MetricExplain key={key} title={`${METRIC_INFO[key].label} (${METRIC_INFO[key].technical})`} copy={METRIC_INFO[key].help} />
              ))}
            </div>
          </div>

          <div className="soft-panel rounded-lg p-5">
            <h3 className="text-lg font-semibold">Current session summary</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {metricCards.map((card) => (
                <div key={card.key} className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{card.label}</p>
                  <p className="mt-1 text-xl font-semibold">{card.value}</p>
                  <p className="mt-1 text-xs leading-4 text-slate-500">{card.help}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ChartPanel
          title="Model Balance tuning curve"
          subtitle={alphaRows.length ? "Shows how the alpha value changes validation ranking quality." : "Run the upgraded evaluator to generate alpha rows."}
        >
          <ResponsiveContainer width="100%" height={380}>
            {alphaRows.length ? (
              <LineChart data={alphaRows} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="alpha" tickFormatter={(value) => Number(value).toFixed(1)} />
                <YAxis tickFormatter={(value) => formatMetricValue("ndcg_at_10", value)} />
                <Tooltip
                  formatter={chartMetricTooltip}
                  labelFormatter={(value) => `Alpha (model balance): ${Number(value).toFixed(1)}`}
                />
                <Legend />
                <Line type="monotone" dataKey="ndcg_at_10" name={METRIC_INFO.ndcg_at_10.label} stroke="#3f6f5f" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="recall_at_10" name={METRIC_INFO.recall_at_10.label} stroke="#c95f4a" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="precision_at_10" name={METRIC_INFO.precision_at_10.label} stroke="#d9a441" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 text-center text-sm text-slate-600">
                <div>
                  <p className="font-medium">No alpha tuning rows found.</p>
                  <p className="mt-1">Run `python src/evaluate_models.py` to create validation/test alpha metrics.</p>
                </div>
              </div>
            )}
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Ranking quality trend" subtitle="Area view makes model differences easier to scan.">
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={testRows} margin={{ top: 20, right: 24, left: 8, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="displayModel" interval={0} angle={-25} textAnchor="end" height={90} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatMetricValue("ndcg_at_10", value)} />
              <Tooltip formatter={chartMetricTooltip} />
              <Legend />
              <Area type="monotone" dataKey="ndcg_at_10" name={METRIC_INFO.ndcg_at_10.label} stroke="#3f6f5f" fill="#3f6f5f" fillOpacity={0.22} />
              <Area type="monotone" dataKey="precision_at_10" name={METRIC_INFO.precision_at_10.label} stroke="#d9a441" fill="#d9a441" fillOpacity={0.18} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className="soft-panel rounded-lg p-5 xl:col-span-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Model comparison table</h3>
              <p className="mt-1 text-sm text-slate-600">Friendly labels with technical names and confidence intervals.</p>
            </div>
            <p className="rounded-md bg-mist px-3 py-2 text-sm text-slate-700">{metrics.summary}</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2">Model</th>
                  <th>{METRIC_INFO.alpha.label}</th>
                  <th>{METRIC_INFO.precision_at_10.label}</th>
                  <th>{METRIC_INFO.recall_at_10.label}</th>
                  <th>{METRIC_INFO.ndcg_at_10.label}</th>
                  <th>{METRIC_INFO.hit_rate_at_10.label}</th>
                  <th>Confidence interval</th>
                </tr>
              </thead>
              <tbody>
                {testRows.map((row, index) => (
                  <tr key={`${row.model}-${index}`} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{row.model}</td>
                    <td>{row.alpha === "" || row.alpha === null || row.alpha === undefined ? "-" : Number(row.alpha).toFixed(1)}</td>
                    <td>{formatMetricValue("precision_at_10", row.precision_at_10)}</td>
                    <td>{formatMetricValue("recall_at_10", row.recall_at_10)}</td>
                    <td>{formatMetricValue("ndcg_at_10", row.ndcg_at_10)}</td>
                    <td>{row.hit_rate_at_10 === undefined ? "-" : formatMetricValue("hit_rate_at_10", row.hit_rate_at_10)}</td>
                    <td>{formatCi("ndcg_at_10", row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}

function About() {
  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Methodology</p>
        <h2 className="mt-1 text-3xl font-semibold">How the recommender works</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">
          This page explains the project in plain language: how the app turns selected movies into recommendations, how the
          offline benchmark measures model quality, and why the live demo metrics should be read differently from the saved
          evaluation results.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-4">
        <MethodCard
          icon={Users}
          title="1. Learn taste"
          copy="The visitor selects or rates movies. High-rated selections, favorite genres, and feedback become the session taste profile."
        />
        <MethodCard
          icon={Brain}
          title="2. Score movies"
          copy="The backend scores unseen movies using content similarity, rating-prior strength, popularity, and discovery signals."
        />
        <MethodCard
          icon={GitBranch}
          title="3. Balance signals"
          copy="The model-balance control shifts the ranking between content-heavy and collaborative-style scoring."
        />
        <MethodCard
          icon={BarChart3}
          title="4. Explain results"
          copy="Cards show why a movie was recommended, while the dashboard separates live list quality from offline benchmark quality."
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="soft-panel rounded-lg p-6">
          <h3 className="text-xl font-semibold">Offline evaluator vs live demo</h3>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            The project has two recommendation layers with different jobs. The offline evaluator is the measurement layer: it
            trains and compares popularity, genre, content, CF SVD, and hybrid recommenders on historical MovieLens ratings.
            The live demo is the product layer: it responds quickly to selected movies, filters, feedback buttons, and slider
            changes so a visitor can feel how the recommender behaves.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ControlExplain title="Offline evaluator" copy="Uses chronological per-user holdout. Older ratings are used as known history, then future liked movies are hidden and checked against top-10 recommendations." />
            <ControlExplain title="Live serving layer" copy="Uses lightweight content similarity, rating-prior scoring, novelty controls, feedback actions, and explanation tags for fast local interaction." />
          </div>
        </div>

        <div className="soft-panel rounded-lg p-6">
          <h3 className="text-xl font-semibold">What each control means</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ControlExplain title="Model balance" copy="Moves ranking toward crowd behavior or toward movies similar to the selected profile." />
            <ControlExplain title="Discovery" copy="Raises or lowers novelty so the list can include less obvious movies." />
            <ControlExplain title="Genre filter" copy="Restricts recommendations to genres the visitor wants right now." />
            <ControlExplain title="Year filter" copy="Supports modern/classic preference without changing the trained model." />
            <ControlExplain title="Feedback buttons" copy="Lets visitors reshape the session with like, dislike, watched, hide, and more-like-this actions." />
            <ControlExplain title="Dashboard" copy="Separates live session-list quality from offline model evaluation results." />
          </div>
        </div>
      </section>

      <section className="soft-panel rounded-lg p-6">
        <h3 className="text-xl font-semibold">How model quality is evaluated</h3>
        <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-700">
          The evaluator simulates a realistic recommendation task. For each sampled user, the system learns from movies the user
          rated earlier, hides later movies they liked, recommends 10 unseen movies, and measures whether those hidden liked movies
          appear near the top. This keeps the benchmark separate from the interactive demo and makes the dashboard easier to trust.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricExplain title="Top-10 Accuracy" copy="Of the 10 recommended movies, this estimates how many were truly relevant hidden likes." />
          <MetricExplain title="Liked Movies Found" copy="Of the future-liked movies hidden from the model, this shows how many were recovered in the recommendation list." />
          <MetricExplain title="Ranking Quality" copy="Rewards lists that place relevant movies higher. A good movie at rank 1 counts more than the same movie at rank 10." />
          <MetricExplain title="Good Match Rate" copy="Shows how often a user gets at least one relevant recommendation in the top 10." />
        </div>
      </section>

      <section className="soft-panel rounded-lg p-6">
        <h3 className="text-xl font-semibold">How recommendations are built in this app</h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          In the demo, selected and rated movies become the visitor's taste profile. The backend looks for unseen movies that share
          genres and text features with that profile, combines those signals with a rating-prior score, then adjusts the ranking with
          the model-balance and discovery controls. Feedback actions change the current session by boosting similar items, hiding
          rejected items, and excluding watched movies.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ControlExplain title="Taste profile" copy="Built from selected movies, star ratings, favorite genres, and feedback from the current session." />
          <ControlExplain title="Hybrid ranking" copy="Blends content similarity with rating-prior and collaborative-style signals, then applies filters and novelty preference." />
          <ControlExplain title="Explanations" copy="Each card explains the main signals: liked reference movies, overlapping genres, strong score components, and discovery value." />
        </div>
      </section>
    </div>
  );
}

function MethodCard({ icon: Icon, title, copy }) {
  return (
    <article className="lift-card rounded-lg border border-slate-200 bg-white p-5">
      <Icon size={22} className="text-moss" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </article>
  );
}

function ControlExplain({ title, copy }) {
  return (
    <div className="rounded-md border border-slate-100 bg-white p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

function MetricCard({ title, value, technical, help }) {
  return (
    <div className="lift-card rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-moss" title={help}>
          {technical}
        </span>
      </div>
      <p className="mt-3 min-h-12 text-sm leading-5 text-slate-600">{help}</p>
    </div>
  );
}

function MetricExplain({ title, copy }) {
  return (
    <div className="rounded-md border border-slate-100 bg-white p-4">
      <p className="font-semibold text-moss">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

function GenrePicker({ genres, selected, toggleGenre, title, maxSelected }) {
  const selectionLimitReached = maxSelected && selected.length >= maxSelected;
  return (
    <div className="soft-panel rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {maxSelected && <span className="text-sm text-slate-600">{selected.length}/{maxSelected} selected</span>}
      </div>
      {maxSelected && (
        <p className="mt-2 text-sm text-slate-600">
          Select up to {maxSelected} genres. The movie list above refreshes to show up to 20 matching movies.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {genres.slice(0, 24).map((genre) => (
          (() => {
            const isSelected = selected.includes(genre);
            const isDisabled = Boolean(selectionLimitReached && !isSelected);
            return (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                disabled={isDisabled}
                className={`focus-ring rounded-md border px-3 py-1.5 text-sm ${
                  isSelected
                    ? "border-moss bg-moss text-white"
                    : isDisabled
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                      : "border-slate-200 hover:border-moss"
                }`}
              >
                {genre}
              </button>
            );
          })()
        ))}
      </div>
    </div>
  );
}

function ControlSlider({ label, left, right, value, setValue, help }) {
  return (
    <div className="soft-panel rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        <span className="rounded-md bg-mist px-2 py-1 text-sm font-semibold">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="mt-4 w-full accent-moss"
      />
      <div className="mt-2 flex justify-between text-sm text-slate-600">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      {help && <p className="mt-3 text-sm leading-5 text-slate-600">{help}</p>}
    </div>
  );
}

function MetricChip({ label, value, max = 1 }) {
  const numeric = Number(value || 0);
  const width = Math.max(0, Math.min((numeric / max) * 100, 100));
  return (
    <div className="rounded-md bg-slate-50 px-2 py-2">
      <span className="block text-[11px] uppercase text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{numeric.toFixed(2)}</span>
      <span className="score-meter mt-2 block">
        <span style={{ width: `${width}%` }} />
      </span>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="soft-panel rounded-lg p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SummaryPanel({ selected, alpha, novelty, catalogMetrics, status }) {
  return (
    <div className="soft-panel rounded-lg p-4">
      <h2 className="font-semibold">Session summary</h2>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Selected movies</span>
          <span className="font-medium">{selected.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Alpha</span>
          <span className="font-medium">{alpha.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Novelty</span>
          <span className="font-medium">{novelty.toFixed(2)}</span>
        </div>
        {Object.entries(catalogMetrics).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-slate-600">{METRIC_INFO[key]?.label ?? key}</span>
            <span className="font-medium">{formatMetricValue(key, value)}</span>
          </div>
        ))}
      </div>
      {status && <p className="mt-4 rounded-md bg-coral/10 p-3 text-sm text-coral">{status}</p>}
    </div>
  );
}

export default App;

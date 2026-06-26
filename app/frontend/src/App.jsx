import { useEffect, useMemo, useState } from "react";
import { fetchGenres, fetchMetrics, fetchRecommendations, searchMovies, sendFeedback } from "./api";
import { tabs } from "./lib/constants";
import Home from "./components/Home";
import Onboarding from "./components/Onboarding";
import Controls from "./components/Controls";
import About from "./components/About";
import Recommendations from "./components/recommendations/Recommendations";
import Dashboard from "./components/dashboard/Dashboard";
import { SummaryPanel } from "./components/shared/Shared";
import { shortModelName } from "./lib/uiHelpers";

function extractYear(title) {
  const match = title?.match(/\((\d{4})\)/);
  return match ? Number(match[1]) : null;
}

export default function App() {
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
    fetchMetrics().then(setMetrics).catch(() => setMetrics({ rows: [], summary: "Metrics are unavailable right now." }));
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
      setStatus("Could not reach the backend. Start FastAPI on port 8000 and try again.");
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
          {activeTab === "home" && <Home setActiveTab={setActiveTab} metrics={metrics} selectedCount={selected.length} />}

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

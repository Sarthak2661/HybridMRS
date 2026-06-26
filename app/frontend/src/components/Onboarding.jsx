import { Search, Sparkles, Star, X } from "lucide-react";
import { GenrePicker } from "./shared/Shared";

export default function Onboarding({
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

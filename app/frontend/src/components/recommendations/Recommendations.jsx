import { Sparkles } from "lucide-react";
import { feedbackActions } from "../../lib/constants";
import { MetricChip } from "../shared/Shared";

export default function Recommendations({ recommendations, selectedCount, onFeedback, onRefresh, status }) {
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
                    <p className="mt-1 text-sm text-slate-600">{movie.year || "Year unknown"} | {movie.genres.join(", ")}</p>
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

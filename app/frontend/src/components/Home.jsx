import { ArrowRight, Film, Gauge, Layers3, Play, ShieldCheck, Sparkles } from "lucide-react";
import { HomeStat, SignalRow } from "./shared/Shared";

export default function Home({ setActiveTab, metrics, selectedCount }) {
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
                Recommender demo with offline evaluation
              </div>
              <h2 className="reveal mt-5 text-4xl font-semibold leading-tight md:text-6xl">
                A movie recommender you can actually inspect.
              </h2>
              <p className="reveal mt-5 max-w-2xl text-base leading-7 text-white/85 md:text-lg">
                Pick movies you like, tune the ranking mix, read the explanations, and compare the live results with saved offline metrics.
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
        <HomeStat icon={Gauge} label="Best saved model" value={best?.model ?? "Run metrics"} />
        <HomeStat icon={ShieldCheck} label="Selected movies" value={String(selectedCount)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {[
          ["1", "Build a profile", "Search, rate movies, and choose favorite genres to give the session a starting point."],
          ["2", "Adjust ranking", "Change alpha, novelty, genre filters, year range, and watched exclusion."],
          ["3", "Check the results", "Read the explanations and compare the live list with the saved offline metrics."]
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

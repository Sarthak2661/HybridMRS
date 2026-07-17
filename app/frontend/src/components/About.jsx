import { BarChart3, Brain, GitBranch, Users } from "lucide-react";
import { ControlExplain, MethodCard, MetricExplain } from "./shared/Shared";

export default function About() {
  return (
    <div className="space-y-7">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Methodology</p>
        <h2 className="mt-1 text-3xl font-semibold">How the recommender works</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">
          This page gives the plain-English version of what the app is doing, how the saved benchmark was measured, and why the live metrics mean something a little different.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-4">
        <MethodCard
          icon={Users}
          title="1. Learn taste"
          copy="The visitor can choose up to 3 favorite genres, see up to 20 matching starter movies, then rate 10 movies to build the session taste profile."
        />
        <MethodCard
          icon={Brain}
          title="2. Score movies"
          copy="The backend scores unseen movies using rating-weighted content similarity, a Bayesian rating prior, genre specificity, and discovery signals."
        />
        <MethodCard
          icon={GitBranch}
          title="3. Balance signals"
          copy="The model-balance control shifts ranking between content-heavy and collaborative-style scoring while filters shape the final list."
        />
        <MethodCard
          icon={BarChart3}
          title="4. Explain results"
          copy="Cards show why a movie was recommended, and the dashboard includes both offline benchmark charts and direct model comparisons."
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="soft-panel rounded-lg p-6">
          <h3 className="text-xl font-semibold">Offline evaluator vs live demo</h3>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            There are really two parts here. The offline evaluator is for measurement: it compares popularity, genre, content, CF SVD, and hybrid models on historical MovieLens ratings. The live demo is for interaction: it reacts quickly to selected movies, filters, feedback, and slider changes.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ControlExplain title="Offline evaluator" copy="Uses chronological per-user holdout. Older ratings are used as known history, then future liked movies are hidden and checked against top-10 recommendations." />
            <ControlExplain title="Live serving layer" copy="Uses fast content similarity, Bayesian rating-prior scoring, genre weighting, novelty controls, feedback actions, and explanation tags for local interaction." />
          </div>
        </div>

        <div className="soft-panel rounded-lg p-6">
          <h3 className="text-xl font-semibold">What each control means</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ControlExplain title="Favorite genres" copy="Lets the visitor pick up to 3 genres, refresh the onboarding movie pool, and give the session a stronger cold-start signal." />
            <ControlExplain title="Model balance" copy="Moves ranking toward crowd behavior or toward movies similar to the selected profile." />
            <ControlExplain title="Discovery" copy="Raises or lowers novelty so the list can include less obvious movies." />
            <ControlExplain title="Genre filter" copy="Restricts final recommendations to genres the visitor wants right now." />
            <ControlExplain title="Year filter" copy="Supports modern/classic preference without changing the trained model." />
            <ControlExplain title="Feedback buttons" copy="Lets visitors reshape the session with like, dislike, watched, hide, and more-like-this actions." />
            <ControlExplain title="Dashboard" copy="Separates live session-list quality from offline model evaluation results." />
          </div>
        </div>
      </section>

      <section className="soft-panel rounded-lg p-6">
          <h3 className="text-xl font-semibold">How model quality is evaluated</h3>
          <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-700">
          The evaluator uses a straightforward setup. For each sampled user, it trains on older ratings, hides later movies the user liked, recommends 10 unseen movies, and checks whether those hidden likes show up near the top. The current saved benchmark uses 100 users, so the confidence intervals matter at least as much as the point estimates.
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
          In the demo, selected genres refresh the starter movie pool and the chosen ratings shape the taste profile. The backend builds a rating-weighted profile, looks for unseen movies with similar features, mixes that with a Bayesian rating prior, gives a bit more weight to specific genres, and then applies the balance and discovery controls. Feedback updates the current session by boosting similar items, reducing movies like the ones you hid or disliked, and excluding watched titles.
          </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ControlExplain title="Taste profile" copy="Built from the 10 selected/rated movies, up to 3 favorite genres, and the visitor's ongoing feedback actions." />
          <ControlExplain title="Hybrid ranking" copy="Blends rating-weighted content similarity with Bayesian rating-prior and collaborative-style signals, then applies filters and novelty preference." />
          <ControlExplain title="Model explorer" copy="The dashboard can compare two saved benchmark rows directly, which makes differences between models easier to read." />
        </div>
      </section>
    </div>
  );
}

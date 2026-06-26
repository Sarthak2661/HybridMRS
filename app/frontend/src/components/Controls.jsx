import { Settings2 } from "lucide-react";
import { METRIC_INFO } from "../lib/uiHelpers";
import { ControlSlider, GenrePicker } from "./shared/Shared";

export default function Controls({
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

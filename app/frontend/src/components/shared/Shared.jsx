import { Gauge, Minus, Trophy } from "lucide-react";
import { METRIC_ICONS, METRIC_INFO, deltaLabel, formatMetricValue, metricWinnerLabel } from "../../lib/uiHelpers";

export function SignalRow({ label, value }) {
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

export function HomeStat({ icon: Icon, label, value }) {
  return (
    <div className="lift-card rounded-lg border border-slate-200 bg-white p-4">
      <Icon size={20} className="text-moss" />
      <p className="mt-3 text-sm text-slate-600">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

export function MethodCard({ icon: Icon, title, copy }) {
  return (
    <article className="lift-card rounded-lg border border-slate-200 bg-white p-5">
      <Icon size={22} className="text-moss" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </article>
  );
}

export function ControlExplain({ title, copy }) {
  return (
    <div className="rounded-md border border-slate-100 bg-white p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

export function MetricCard({ title, value, technical, help }) {
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

export function MetricExplain({ title, copy }) {
  return (
    <div className="rounded-md border border-slate-100 bg-white p-4">
      <p className="font-semibold text-moss">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

export function GenrePicker({ genres, selected, toggleGenre, title, maxSelected }) {
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
        {genres.slice(0, 24).map((genre) => {
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
        })}
      </div>
    </div>
  );
}

export function ControlSlider({ label, left, right, value, setValue, help }) {
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

export function MetricChip({ label, value, max = 1 }) {
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

export function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="soft-panel rounded-lg p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function ComparisonModelCard({ label, modelName, accentClass, labelClass }) {
  return (
    <div className={`rounded-lg border p-4 ${accentClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{modelName}</p>
    </div>
  );
}

export function ComparisonMetricCard({ metricKey, leftRow, rightRow, leftName, rightName }) {
  const info = METRIC_INFO[metricKey];
  const Icon = METRIC_ICONS[metricKey] ?? Gauge;
  const leftValue = Number(leftRow?.[metricKey] ?? 0);
  const rightValue = Number(rightRow?.[metricKey] ?? 0);
  const maxValue = Math.max(leftValue, rightValue, 0.0001);
  const leftWidth = `${Math.max((leftValue / maxValue) * 100, leftValue > 0 ? 10 : 0)}%`;
  const rightWidth = `${Math.max((rightValue / maxValue) * 100, rightValue > 0 ? 10 : 0)}%`;
  const winner = metricWinnerLabel(metricKey, leftValue, rightValue, leftName, rightName);
  const winnerClass =
    winner === "About the same"
      ? "bg-slate-100 text-slate-600"
      : winner.includes(rightName)
        ? "bg-moss/12 text-moss"
        : "bg-coral/12 text-coral";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-slate-100 p-2 text-slate-700">
            <Icon size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{info.label}</p>
            <p className="mt-1 text-xs text-slate-500">{info.technical}</p>
          </div>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${winnerClass}`}>{winner}</div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-medium text-slate-700">{leftName}</p>
            <p className="font-semibold text-slate-950">{formatMetricValue(metricKey, leftValue)}</p>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full bg-coral" style={{ width: leftWidth }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-medium text-slate-700">{rightName}</p>
            <p className="font-semibold text-slate-950">{formatMetricValue(metricKey, rightValue)}</p>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full bg-moss" style={{ width: rightWidth }} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Difference</p>
          <p className={`mt-1 text-sm font-semibold ${rightValue >= leftValue ? "text-moss" : "text-coral"}`}>
            {deltaLabel(metricKey, leftValue, rightValue)}
          </p>
        </div>
        <p className="max-w-[13rem] text-right text-xs leading-5 text-slate-500">{info.help}</p>
      </div>
    </div>
  );
}

export function ComparisonWinnerBanner({ overallWinner }) {
  return (
    <div className={`mt-5 rounded-lg border px-4 py-4 ${overallWinner.className}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-white/70 p-2">
          {overallWinner.title.includes("tied") ? <Minus size={18} /> : <Trophy size={18} />}
        </div>
        <div>
          <p className="text-sm font-semibold">{overallWinner.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{overallWinner.copy}</p>
        </div>
      </div>
    </div>
  );
}

export function SummaryPanel({ selected, alpha, novelty, catalogMetrics, status }) {
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

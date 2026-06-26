import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartMetricTooltip, formatCi, formatMetricValue, METRIC_INFO, overallWinnerSummary, winnerCount } from "../../lib/uiHelpers";
import { ChartPanel, ComparisonMetricCard, ComparisonModelCard, ComparisonWinnerBanner, MetricCard, MetricExplain } from "../shared/Shared";

export default function Dashboard({ metrics, testRows, alphaRows, catalogMetrics }) {
  const bestRow = [...testRows].sort((a, b) => Number(b.ndcg_at_10 || 0) - Number(a.ndcg_at_10 || 0))[0];
  const modelCount = new Set(testRows.map((row) => row.model)).size;
  const benchmarkUsers = Math.max(...testRows.map((row) => Number(row.n_users || 0)), 0);
  const [compareLeft, setCompareLeft] = useState(testRows[0]?.model ?? "");
  const [compareRight, setCompareRight] = useState(testRows[1]?.model ?? testRows[0]?.model ?? "");
  const liveMetricKeys = ["coverage", "diversity", "novelty", "serendipity"];
  const offlineMetricKeys = ["precision_at_10", "recall_at_10", "ndcg_at_10", "hit_rate_at_10"];
  const hasLiveMetrics = Object.keys(catalogMetrics).length > 0;
  const modelNames = testRows.map((row) => row.model);
  const leftRow = testRows.find((row) => row.model === compareLeft) ?? testRows[0];
  const rightRow = testRows.find((row) => row.model === compareRight) ?? testRows[Math.min(1, Math.max(testRows.length - 1, 0))];
  const compareSummary = winnerCount(offlineMetricKeys, leftRow, rightRow);
  const overallWinner = overallWinnerSummary(compareSummary, "Model A", "Model B");
  const metricCards = liveMetricKeys.map((key) => ({
    key,
    ...METRIC_INFO[key],
    value: hasLiveMetrics ? formatMetricValue(key, catalogMetrics[key]) : "-"
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
            Go to <span className="font-medium">Movie Selection</span> -&gt; pick movies -&gt; click <span className="font-medium">Generate recommendations</span> to populate these metrics.
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

          <div className="soft-panel rounded-lg p-5 xl:col-span-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Model comparison explorer</h3>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">
                  Pick two saved models and compare them side by side. It is a quick way to see where one does better than the other.
                </p>
              </div>
              <p className="rounded-md bg-mist px-3 py-2 text-sm text-slate-700">Saved benchmark rows</p>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1.1fr]">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Model A</span>
                <select value={compareLeft} onChange={(event) => setCompareLeft(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3">
                  {modelNames.map((name) => (
                    <option key={`left-${name}`} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Model B</span>
                <select value={compareRight} onChange={(event) => setCompareRight(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3">
                  {modelNames.map((name) => (
                    <option key={`right-${name}`} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-950">At a glance</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Green means <span className="font-medium text-moss">Model B</span> is stronger on that metric. Coral means <span className="font-medium text-coral">Model A</span> is stronger.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md bg-coral/10 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-coral">Model A leads</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{compareSummary.left}</p>
                  </div>
                  <div className="rounded-md bg-moss/10 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-moss">Model B leads</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{compareSummary.right}</p>
                  </div>
                  <div className="rounded-md bg-slate-100 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-600">Ties</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{compareSummary.ties}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <ComparisonModelCard label="Model A" modelName={leftRow?.model ?? "Not selected"} accentClass="border-coral/30 bg-coral/5" labelClass="text-coral" />
              <ComparisonModelCard label="Model B" modelName={rightRow?.model ?? "Not selected"} accentClass="border-moss/30 bg-moss/5" labelClass="text-moss" />
            </div>

            <ComparisonWinnerBanner overallWinner={overallWinner} />

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {offlineMetricKeys.map((key) => (
                <ComparisonMetricCard
                  key={key}
                  metricKey={key}
                  leftRow={leftRow}
                  rightRow={rightRow}
                  leftName="Model A"
                  rightName="Model B"
                />
              ))}
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

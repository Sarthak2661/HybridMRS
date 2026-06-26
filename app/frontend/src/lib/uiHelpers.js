import { Brain, Compass, Gauge, Layers3, ShieldCheck, Sparkles, Star, Target, TrendingUp } from "lucide-react";

export const METRIC_INFO = {
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

export const METRIC_ICONS = {
  precision_at_10: Target,
  recall_at_10: Compass,
  ndcg_at_10: TrendingUp,
  hit_rate_at_10: ShieldCheck,
  coverage: Layers3,
  diversity: Sparkles,
  novelty: Star,
  serendipity: Brain,
  alpha: Gauge
};

export function formatMetricValue(key, value) {
  const numeric = Number(value ?? 0);
  if (METRIC_INFO[key]?.percent) {
    const digits = key === "coverage" ? 3 : 1;
    return `${(numeric * 100).toFixed(digits)}%`;
  }
  return numeric.toFixed(2);
}

export function formatCi(metricKey, row) {
  const low = row[`${metricKey}_ci_low`];
  const high = row[`${metricKey}_ci_high`];
  if (low === undefined || high === undefined || low === "" || high === "") return "-";
  return `${METRIC_INFO[metricKey].technical}: ${formatMetricValue(metricKey, row[metricKey])} +/- CI [${formatMetricValue(metricKey, low)}, ${formatMetricValue(metricKey, high)}]`;
}

export function chartMetricTooltip(value, name, item) {
  const key = item?.dataKey ?? name;
  return [formatMetricValue(key, value), METRIC_INFO[key]?.label ?? name];
}

export function shortModelName(name = "") {
  return name
    .replace("Hybrid (CF + Content)", "Hybrid")
    .replace("Content (k-best)", "Content")
    .replace("CF (SVD)", "CF SVD")
    .replace("Hybrid history-alpha", "History alpha")
    .replace("Hybrid tuned", "Hybrid tuned");
}

export function deltaLabel(metricKey, leftValue, rightValue) {
  const delta = Number(rightValue ?? 0) - Number(leftValue ?? 0);
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "+/-";
  const absolute = Math.abs(delta);
  if (METRIC_INFO[metricKey]?.percent) {
    const digits = metricKey === "coverage" ? 3 : 1;
    return `${sign}${(absolute * 100).toFixed(digits)}%`;
  }
  return `${sign}${absolute.toFixed(2)}`;
}

export function metricWinnerLabel(metricKey, leftValue, rightValue, leftName, rightName) {
  const left = Number(leftValue ?? 0);
  const right = Number(rightValue ?? 0);
  if (Math.abs(right - left) < 0.0001) {
    return "About the same";
  }
  return right > left ? `${rightName} leads` : `${leftName} leads`;
}

export function winnerCount(metricKeys, leftRow, rightRow) {
  return metricKeys.reduce(
    (summary, key) => {
      const left = Number(leftRow?.[key] ?? 0);
      const right = Number(rightRow?.[key] ?? 0);
      if (Math.abs(right - left) < 0.0001) {
        summary.ties += 1;
      } else if (right > left) {
        summary.right += 1;
      } else {
        summary.left += 1;
      }
      return summary;
    },
    { left: 0, right: 0, ties: 0 }
  );
}

export function overallWinnerSummary(compareSummary, leftName, rightName) {
  if (compareSummary.right > compareSummary.left) {
    return {
      title: `${rightName} is the stronger overall model`,
      copy: `${rightName} leads on ${compareSummary.right} of the 4 benchmark metrics in this comparison.`,
      className: "border-moss/25 bg-moss/8 text-moss"
    };
  }
  if (compareSummary.left > compareSummary.right) {
    return {
      title: `${leftName} is the stronger overall model`,
      copy: `${leftName} leads on ${compareSummary.left} of the 4 benchmark metrics in this comparison.`,
      className: "border-coral/25 bg-coral/8 text-coral"
    };
  }
  return {
    title: "These two models are basically tied",
    copy: `Neither side clearly leads overall. ${compareSummary.ties} metric${compareSummary.ties === 1 ? "" : "s"} are tied in this comparison.`,
    className: "border-slate-200 bg-slate-50 text-slate-700"
  };
}


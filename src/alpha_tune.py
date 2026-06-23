import matplotlib.pyplot as plt
import pandas as pd
from src.config import PROCESSED_DATA_DIR, PROJECT_ROOT

def plot_alpha_tuning():
    metrics_path = PROCESSED_DATA_DIR / "model_comparison_metrics.csv"
    print(f"Loading metrics from {metrics_path} ...")
    df = pd.read_csv(metrics_path)

    # Separate CF baseline and hybrid rows
    cf_df = df[df["model"] == "CF (SVD)"].copy()
    hybrid_df = df[df["model"] == "Hybrid (CF + Content)"].copy()

    if hybrid_df.empty:
        raise ValueError("No Hybrid rows found in metrics CSV. "
                         "Make sure evaluate_models.py saved them correctly.")

    hybrid_df = hybrid_df.sort_values("alpha")

    # Extract arrays
    alphas = hybrid_df["alpha"].values
    prec_h = hybrid_df["precision_at_10"].values
    rec_h = hybrid_df["recall_at_10"].values
    ndcg_h = hybrid_df["ndcg_at_10"].values

    # CF baseline values (single row)
    cf_prec = cf_df["precision_at_10"].iloc[0]
    cf_rec = cf_df["recall_at_10"].iloc[0]
    cf_ndcg = cf_df["ndcg_at_10"].iloc[0]

    # Plots
    fig, axes = plt.subplots(1, 3, figsize=(15, 4), sharex=True)

    # Precision@10
    ax = axes[0]
    ax.plot(alphas, prec_h, marker="o", linestyle="-", label="Hybrid")
    ax.axhline(cf_prec, color="gray", linestyle="--", label="CF baseline")
    ax.set_title("Precision@10 vs α")
    ax.set_xlabel("α (CF weight)")
    ax.set_ylabel("Precision@10")
    ax.grid(True, linestyle=":", alpha=0.6)
    ax.legend()

    # Recall@10
    ax = axes[1]
    ax.plot(alphas, rec_h, marker="o", linestyle="-", label="Hybrid")
    ax.axhline(cf_rec, color="gray", linestyle="--", label="CF baseline")
    ax.set_title("Recall@10 vs α")
    ax.set_xlabel("α (CF weight)")
    ax.set_ylabel("Recall@10")
    ax.grid(True, linestyle=":", alpha=0.6)
    ax.legend()

    # NDCG@10
    ax = axes[2]
    ax.plot(alphas, ndcg_h, marker="o", linestyle="-", label="Hybrid")
    ax.axhline(cf_ndcg, color="gray", linestyle="--", label="CF baseline")
    ax.set_title("NDCG@10 vs α")
    ax.set_xlabel("α (CF weight)")
    ax.set_ylabel("NDCG@10")
    ax.grid(True, linestyle=":", alpha=0.6)
    ax.legend()

    fig.suptitle("Alpha Tuning: CF vs Hybrid (k=10)", fontsize=14)
    plt.tight_layout(rect=[0, 0, 1, 0.95])


    figures_dir = PROJECT_ROOT / "reports" / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)
    out_path = figures_dir / "alpha_tuning_metrics.png"
    fig.savefig(out_path, dpi=200)
    print(f"✅ Saved alpha tuning plot to {out_path}")

    plt.show()


if __name__ == "__main__":
    plot_alpha_tuning()

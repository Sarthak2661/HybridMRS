import numpy as np
from typing import List, Set


def precision_recall_at_k(
    recommended: List[int],
    relevant: Set[int],
    k: int,
):
    if k == 0:
        return 0.0, 0.0

    rec_k = recommended[:k]
    rec_set = set(rec_k)
    hits = len(rec_set & relevant)

    precision = hits / k
    recall = hits / len(relevant) if relevant else 0.0
    return precision, recall


def ndcg_at_k(
    recommended: List[int],
    relevant: Set[int],
    k: int,
):
    rec_k = recommended[:k]
    dcg = 0.0
    for i, mid in enumerate(rec_k):
        if mid in relevant:
            dcg += 1.0 / np.log2(i + 2)  # positions are 1-based

    ideal_hits = min(len(relevant), k)
    if ideal_hits == 0:
        return 0.0

    idcg = sum(1.0 / np.log2(i + 2) for i in range(ideal_hits))
    return dcg / idcg if idcg > 0 else 0.0

"""Explainable race prediction + optional logistic calibration trained on past races."""
import math
import random
from collections import defaultdict
from dataclasses import dataclass, field
from statistics import mean
from typing import Dict, List, Optional

from analytics import (
    RACES, _score, bike_relative_ranking, circuit_ranking, condition_ranking, dnf_rate_ranking,
    qualifying_ranking,
)

WEIGHTS = {
    "championship": 0.15,  # points share of the leader
    "form": 0.20,          # last five races this season
    "bike": 0.15,          # constructor level this season
    "circuit": 0.15,       # history on this track (all categories, shrunk)
    "condition": 0.15,     # dry/wet skill blended with the rain probability
    "talent": 0.05,        # gap to riders on the same bike
    "qualifying": 0.10,    # grid positions
    "reliability": 0.05,   # 1 - DNF rate
}
HOME_BONUS = 0.02
TEMPERATURE = 12.0  # softmax sharpness for the uncalibrated score
NEUTRAL = 0.5


@dataclass
class CalibratedModel:
    """Softmax temperature fitted on past races: keeps the explainable score, calibrates its sharpness."""
    temperature: float
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {"temperature": self.temperature, "meta": self.meta}

    @classmethod
    def from_dict(cls, data: dict) -> "CalibratedModel":
        return cls(data["temperature"], data.get("meta", {}))


def _log_likelihood(races, temperature: float) -> float:
    total = 0.0
    for scores, winner in races:
        top = max(scores)
        norm = sum(math.exp(temperature * (s - top)) for s in scores)
        total += temperature * (scores[winner] - top) - math.log(norm)
    return total


def fit_temperature(races: List[tuple], low: float = 1.0, high: float = 80.0, steps: int = 80) -> float:
    """Maximum-likelihood temperature on (scores, winner_index) pairs, log-spaced grid search."""
    grid = [low * (high / low) ** (i / (steps - 1)) for i in range(steps)]
    return max(grid, key=lambda t: _log_likelihood(races, t))


def simulate_positions(probs: List[float], runs: int = 3000, seed: int = 7) -> List[dict]:
    """Plackett-Luce finishing orders via the Gumbel trick (sort log p + Gumbel noise)."""
    rng = random.Random(seed)
    n = len(probs)
    logs = [math.log(max(p, 1e-9)) for p in probs]
    counts = [[0, 0, 0, 0] for _ in range(n)]  # wins, podiums, top5, sum of positions
    for _ in range(runs):
        noisy = sorted(range(n), key=lambda i: -(logs[i] - math.log(-math.log(rng.random() or 1e-12))))
        for position, i in enumerate(noisy, 1):
            c = counts[i]
            c[0] += position == 1
            c[1] += position <= 3
            c[2] += position <= 5
            c[3] += position
    return [{"win": c[0] / runs, "podium": c[1] / runs, "top5": c[2] / runs, "expected": c[3] / runs} for c in counts]


def _by_id(ranking: List[dict]) -> Dict[int, dict]:
    return {item["rider_id"]: item for item in ranking}


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def race_features(rows: List[dict], entrants: List[dict], circuit_id: str, category: str, year: int,
                  wet_weight: float, event_country: Optional[str] = None) -> List[dict]:
    """Factor values in [0, 1] for each entrant, using only `rows` (pass history before the race to train)."""
    cat_rows = [r for r in rows if r.get("category") == category]
    recent = [r for r in cat_rows if r.get("year", 0) >= year - 1]
    season_races = [r for r in cat_rows if r.get("year") == year and r.get("session") in RACES]

    wet = _by_id(condition_ranking(rows, "wet"))
    dry = _by_id(condition_ranking(rows, "dry"))
    circuit = _by_id(circuit_ranking(rows, [circuit_id]))
    talent = _by_id(bike_relative_ranking(recent))
    quali = _by_id(qualifying_ranking(recent))
    dnf = _by_id(dnf_rate_ranking(recent))

    by_rider = defaultdict(list)
    for r in sorted(season_races, key=lambda r: r.get("date") or ""):
        by_rider[r["rider_id"]].append(_score(r))
    bike_level = defaultdict(list)
    for r in season_races:
        bike_level[r.get("constructor")].append(_score(r))
    bike_level = {k: mean(v) for k, v in bike_level.items()}
    best_bike = max(bike_level.values(), default=0) or 1
    max_points = max((e.get("points") or 0 for e in entrants), default=0)

    out = []
    for e in entrants:
        rid = e["rider_id"]
        form_scores = by_rider.get(rid, [])[-5:]
        w, d = wet.get(rid), dry.get(rid)
        if w and d:
            condition = wet_weight * w["score"] + (1 - wet_weight) * d["score"]
        else:
            condition = (w or d or {}).get("score", NEUTRAL)
        factors = {
            "championship": (e.get("points") or 0) / max_points if max_points else NEUTRAL,
            "form": mean(form_scores) if form_scores else NEUTRAL,
            "bike": bike_level.get(e.get("constructor"), NEUTRAL * best_bike) / best_bike,
            "circuit": circuit[rid]["score"] if rid in circuit else NEUTRAL,
            "condition": condition,
            "talent": _clamp(NEUTRAL + talent[rid]["score"]) if rid in talent else NEUTRAL,
            "qualifying": quali[rid]["score"] if rid in quali else NEUTRAL,
            "reliability": 1 - dnf[rid]["score"] if rid in dnf else NEUTRAL,
        }
        out.append({
            "factors": {k: round(_clamp(v), 4) for k, v in factors.items()},
            "home": bool(event_country) and e.get("rider_country") == event_country,
            "recent_results": [r for r in by_rider.get(rid, [])[-5:]],
            "circuit_results": circuit[rid]["results"] if rid in circuit else [],
            "condition_samples": {"wet": (w or {}).get("n", 0), "dry": (d or {}).get("n", 0)},
        })
    return out


def predict_race(rows: List[dict], entrants: List[dict], circuit_id: str, category: str, year: int,
                 wet_weight: float, event_country: Optional[str] = None,
                 model: Optional[CalibratedModel] = None, runs: int = 3000) -> List[dict]:
    if not entrants:
        return []
    feats = race_features(rows, entrants, circuit_id, category, year, wet_weight, event_country)
    scores = [sum(WEIGHTS[k] * f["factors"][k] for k in WEIGHTS) + HOME_BONUS * f["home"] for f in feats]
    temperature = model.temperature if model else TEMPERATURE
    top = max(scores)
    raw = [math.exp(temperature * (s - top)) for s in scores]
    total = sum(raw)
    probs = [p / total for p in raw]
    sims = simulate_positions(probs, runs=runs)

    out = []
    for e, f, score, p, sim in zip(entrants, feats, scores, probs, sims):
        out.append({
            **e, **f, "score": round(score, 4), "win": p,
            "podium": round(max(sim["podium"], p), 4), "top5": round(max(sim["top5"], p), 4),
            "expected_position": round(sim["expected"], 2),
        })
    out.sort(key=lambda item: item["win"], reverse=True)
    for i, item in enumerate(out, 1):
        item["rank"] = i
    return out


def train_win_model(rows: List[dict], category: str = "MotoGP", since: int = 2022, max_races: int = 80) -> Optional[CalibratedModel]:
    """Fits the score temperature on past races, each scored with only the history that existed before it."""
    races = sorted({(r["date"], r["event_id"], r.get("circuit_id"), r.get("country"), r["year"])
                    for r in rows if r.get("category") == category and r.get("session") == "RAC"
                    and r.get("year", 0) >= since})[-max_races:]
    ordered = sorted(rows, key=lambda r: r.get("date") or "")
    samples = []
    for date, event_id, circuit_id, country, year in races:
        before = [r for r in ordered if (r.get("date") or "") < date]
        field_rows = [r for r in rows if r["event_id"] == event_id and r.get("category") == category and r.get("session") == "RAC"]
        winner = next((i for i, r in enumerate(field_rows) if r.get("pos") == 1), None)
        if not before or winner is None:
            continue
        points = defaultdict(float)
        for r in before:
            if r.get("year") == year and r.get("category") == category and r.get("session") in RACES and r.get("pos"):
                points[r["rider_id"]] += max(0, 26 - r["pos"])  # proxy for championship points
        entrants = [{"rider_id": r["rider_id"], "constructor": r.get("constructor"), "rider_country": r.get("rider_country"),
                     "points": points[r["rider_id"]]} for r in field_rows]
        wet = 1.0 if (field_rows[0].get("track") or "Dry").lower() != "dry" else 0.0
        feats = race_features(before, entrants, circuit_id, category, year, wet, country)
        scores = [sum(WEIGHTS[k] * f["factors"][k] for k in WEIGHTS) + HOME_BONUS * f["home"] for f in feats]
        samples.append((scores, winner))
    if not samples:
        return None
    return CalibratedModel(fit_temperature(samples), {"races": len(samples), "category": category, "since": since})

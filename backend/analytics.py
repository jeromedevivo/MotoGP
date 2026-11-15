"""Pure rider analytics computed from the flat history rows built by history.py."""
import re
from collections import defaultdict
from statistics import mean, pstdev
from typing import Callable, Dict, Iterable, List, Optional

SESSION_WEIGHT = {"RAC": 1.0, "SPR": 0.8, "Q": 0.6}
RACES = ("RAC", "SPR")
HOT_GROUND = 45
COLD_GROUND = 20

CONDITIONS: Dict[str, Callable[[dict], bool]] = {
    "wet": lambda r: bool(r.get("track")) and r["track"].lower() != "dry",
    "dry": lambda r: (r.get("track") or "").lower() == "dry",
    "hot": lambda r: r.get("ground") is not None and r["ground"] >= HOT_GROUND,
    "cold": lambda r: r.get("ground") is not None and r["ground"] <= COLD_GROUND,
}


# --- parsing -----------------------------------------------------------------

def parse_gap(raw) -> Optional[float]:
    try:
        return float(str(raw).lstrip("+"))
    except (TypeError, ValueError):
        return None


def parse_temp(raw) -> Optional[int]:
    match = re.match(r"\s*(-?\d+)", str(raw or ""))
    return int(match.group(1)) if match else None


def lap_seconds(raw) -> Optional[float]:
    match = re.match(r"^(\d+)[:'](\d+(?:\.\d+)?)$", str(raw or "").strip())
    return int(match.group(1)) * 60 + float(match.group(2)) if match else None


# --- scoring primitives --------------------------------------------------------

def result_score(pos, field) -> Optional[float]:
    """1.0 for a win, 0.0 for last place, None when not classified."""
    if pos is None:
        return None
    if not field or field <= 1:
        return 1.0
    return max(0.0, min(1.0, 1 - (pos - 1) / (field - 1)))


def shrink(value: float, n: float, prior: float, k: float = 3) -> float:
    """Bayesian average: small samples are pulled toward the prior."""
    return (value * n + prior * k) / (n + k)


def _score(r: dict) -> Optional[float]:
    score = result_score(r.get("pos"), r.get("field"))
    if score is None and r.get("session") in RACES:
        return 0.0  # a race DNF counts as the worst result
    return score


def _weight(r: dict) -> float:
    return SESSION_WEIGHT.get(r.get("session"), 0.3)


def _wmean(rows: Iterable[dict]):
    total = weight = 0.0
    for r in rows:
        s = _score(r)
        if s is not None:
            w = _weight(r)
            total += s * w
            weight += w
    return (total / weight if weight else None), weight


def session_key(r: dict) -> str:
    return f'{r.get("event_id")}|{r.get("category")}|{r.get("session")}|{r.get("number")}'


def _group(rows: Iterable[dict], key) -> Dict:
    groups = defaultdict(list)
    for r in rows:
        groups[key(r)].append(r)
    return groups


def _filter(rows, category=None, since=None, sessions=None):
    return [
        r for r in rows
        if (category is None or r.get("category") == category)
        and (since is None or r.get("year", 0) >= since)
        and (sessions is None or r.get("session") in sessions)
    ]


def rider_meta(rows: List[dict]) -> dict:
    latest = max(rows, key=lambda r: (r.get("year", 0), r.get("date") or ""))
    return {
        "rider_id": latest["rider_id"], "rider": latest.get("rider"),
        "rider_country": latest.get("rider_country"), "constructor": latest.get("constructor"),
        "team": latest.get("team"), "category": latest.get("category"),
    }


def _ranked(items: List[dict], reverse=True) -> List[dict]:
    items.sort(key=lambda item: item["score"], reverse=reverse)
    for i, item in enumerate(items, 1):
        item["rank"] = i
    return items


# --- rankings ------------------------------------------------------------------

def condition_ranking(rows, condition: str, category=None, since=None, k: float = 3) -> List[dict]:
    """Performance in a condition, shrunk toward the rider's overall level; `delta` = gain vs overall."""
    test = CONDITIONS[condition]
    out = []
    for rider_rows in _group(_filter(rows, category, since), lambda r: r["rider_id"]).values():
        overall, _ = _wmean(rider_rows)
        cond_rows = [r for r in rider_rows if test(r)]
        cond, weight = _wmean(cond_rows)
        if cond is None or overall is None:
            continue
        score = shrink(cond, weight, overall, k)
        out.append({**rider_meta(rider_rows), "score": round(score, 4), "raw": round(cond, 4),
                    "delta": round(score - overall, 4), "n": len(cond_rows)})
    return _ranked(out)


def bike_relative_ranking(rows, category=None, since=None, k: float = 3) -> List[dict]:
    """Average gap to the other riders of the same constructor in the same session."""
    deltas = defaultdict(list)
    for session_rows in _group(_filter(rows, category, since), session_key).values():
        for bike_rows in _group(session_rows, lambda r: r.get("constructor")).values():
            scored = [(r, _score(r)) for r in bike_rows]
            scored = [(r, s) for r, s in scored if s is not None]
            if len(scored) < 2:
                continue
            for r, s in scored:
                others = [o for rr, o in scored if rr is not r]
                deltas[r["rider_id"]].append((r, s - mean(others), _weight(r)))
    out = []
    for items in deltas.values():
        weight = sum(w for _, _, w in items)
        avg = sum(d * w for _, d, w in items) / weight
        out.append({**rider_meta([r for r, _, _ in items]), "score": round(shrink(avg, weight, 0, k), 4),
                    "raw": round(avg, 4), "n": len(items)})
    return _ranked(out)


def positions_gained_ranking(rows, category=None, since=None) -> List[dict]:
    out = []
    finished = [r for r in _filter(rows, category, since, RACES) if r.get("pos") and r.get("grid")]
    for rider_rows in _group(finished, lambda r: r["rider_id"]).values():
        gains = [r["grid"] - r["pos"] for r in rider_rows]
        out.append({**rider_meta(rider_rows), "score": round(mean(gains), 3), "n": len(gains)})
    return _ranked(out)


def consistency_ranking(rows, category=None, since=None, min_n: int = 3) -> List[dict]:
    """Standard deviation of finishing positions (lower is steadier)."""
    out = []
    finished = [r for r in _filter(rows, category, since, ("RAC",)) if r.get("pos")]
    for rider_rows in _group(finished, lambda r: r["rider_id"]).values():
        if len(rider_rows) >= min_n:
            positions = [r["pos"] for r in rider_rows]
            out.append({**rider_meta(rider_rows), "score": round(pstdev(positions), 3),
                        "avg": round(mean(positions), 2), "n": len(positions)})
    return _ranked(out, reverse=False)


def qualifying_ranking(rows, category=None, since=None) -> List[dict]:
    out = []
    races = [r for r in _filter(rows, category, since, ("RAC",)) if r.get("grid")]
    for rider_rows in _group(races, lambda r: r["rider_id"]).values():
        grids = [r["grid"] for r in rider_rows]
        score = mean(result_score(r["grid"], r.get("field")) for r in rider_rows)
        out.append({**rider_meta(rider_rows), "score": round(score, 4), "avg": round(mean(grids), 2),
                    "poles": grids.count(1), "n": len(grids)})
    return _ranked(out)


def dnf_rate_ranking(rows, category=None, since=None) -> List[dict]:
    out = []
    for rider_rows in _group(_filter(rows, category, since, RACES), lambda r: r["rider_id"]).values():
        dnf = sum(1 for r in rider_rows if r.get("pos") is None)
        out.append({**rider_meta(rider_rows), "score": round(dnf / len(rider_rows), 4),
                    "dnf": dnf, "n": len(rider_rows)})
    return _ranked(out, reverse=False)


def sprint_vs_race_ranking(rows, category=None, since=None) -> List[dict]:
    out = []
    for rider_rows in _group(_filter(rows, category, since, RACES), lambda r: r["rider_id"]).values():
        sprint, _ = _wmean(r for r in rider_rows if r["session"] == "SPR")
        race, _ = _wmean(r for r in rider_rows if r["session"] == "RAC")
        if sprint is not None and race is not None:
            out.append({**rider_meta(rider_rows), "score": round(sprint - race, 4),
                        "sprint": round(sprint, 4), "race": round(race, 4), "n": len(rider_rows)})
    return _ranked(out)


def momentum_ranking(rows, year: int, last: int = 5, category=None) -> List[dict]:
    out = []
    season = [r for r in _filter(rows, category, sessions=("RAC",)) if r.get("year") == year]
    for rider_rows in _group(season, lambda r: r["rider_id"]).values():
        rider_rows.sort(key=lambda r: r.get("date") or "")
        if len(rider_rows) <= last:
            continue
        scores = [_score(r) for r in rider_rows]
        recent = mean(scores[-last:])
        out.append({**rider_meta(rider_rows), "score": round(recent - mean(scores), 4),
                    "recent": round(recent, 4), "season": round(mean(scores), 4),
                    "results": [r.get("pos") for r in rider_rows[-last:]], "n": len(rider_rows)})
    return _ranked(out)


def home_ranking(rows, category=None, since=None) -> List[dict]:
    out = []
    for rider_rows in _group(_filter(rows, category, since, RACES), lambda r: r["rider_id"]).values():
        home = [r for r in rider_rows if r.get("country") and r.get("country") == r.get("rider_country")]
        away = [r for r in rider_rows if r not in home]
        home_score, _ = _wmean(home)
        away_score, _ = _wmean(away)
        if home_score is not None and away_score is not None:
            out.append({**rider_meta(rider_rows), "score": round(home_score - away_score, 4),
                        "home": round(home_score, 4), "away": round(away_score, 4), "n": len(home)})
    return _ranked(out)


def circuit_ranking(rows, circuit_ids: Iterable[str], category=None, since=None, k: float = 3) -> List[dict]:
    """Like condition_ranking but for a set of circuits (one track or a circuit family)."""
    ids = set(circuit_ids)
    out = []
    for rider_rows in _group(_filter(rows, category, since), lambda r: r["rider_id"]).values():
        overall, _ = _wmean(rider_rows)
        here = [r for r in rider_rows if r.get("circuit_id") in ids]
        value, weight = _wmean(here)
        if value is None or overall is None:
            continue
        score = shrink(value, weight, overall, k)
        out.append({**rider_meta(rider_rows), "score": round(score, 4), "raw": round(value, 4),
                    "delta": round(score - overall, 4), "n": len(here),
                    "results": [{"year": r["year"], "session": r["session"], "pos": r.get("pos"), "track": r.get("track")}
                                for r in sorted(here, key=lambda r: r.get("date") or "") if r["session"] in RACES]})
    return _ranked(out)


def head_to_head(rows, a: int, b: int) -> dict:
    """Who finished ahead when both riders were classified in the same race."""
    result = {key: {"a": 0, "b": 0, "n": 0} for key in ("total", "dry", "wet", "RAC", "SPR")}
    races = [r for r in rows if r.get("session") in RACES and r.get("rider_id") in (a, b) and r.get("pos")]
    for session_rows in _group(races, session_key).values():
        by_rider = {r["rider_id"]: r for r in session_rows}
        if len(by_rider) < 2:
            continue
        winner = "a" if by_rider[a]["pos"] < by_rider[b]["pos"] else "b"
        sample = by_rider[a]
        buckets = ["total", "wet" if CONDITIONS["wet"](sample) else "dry", sample["session"]]
        for bucket in buckets:
            result[bucket][winner] += 1
            result[bucket]["n"] += 1
    return result

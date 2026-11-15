"""Builds a flat, cached dataset of every classified result since `since`.

Finished events never change, so each (event, category) is fetched once and
persisted; later builds only fetch what is missing.
"""
import asyncio
import gzip
import json
import os
from datetime import datetime
from typing import Awaitable, Callable, Optional

from analytics import parse_gap, parse_temp

CATEGORIES = {"MotoGP", "Moto2", "Moto3"}
RESULT_SESSIONS = {"RAC", "SPR", "Q"}

Fetch = Callable[[str], Awaitable]


def category_name(name: str) -> str:
    return (name or "").replace("™", "").strip()


def _int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _float(value) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def circuit_from_broadcast(circuit: dict) -> dict:
    track = circuit.get("track") or {}
    assets = track.get("assets") or {}
    return {
        "lat": _float(circuit.get("lat")), "lng": _float(circuit.get("lng")),
        "city": circuit.get("city"), "constructed": circuit.get("constructed"),
        "designer": circuit.get("designer"), "capacity": circuit.get("capacity"),
        "length": (track.get("lenght_units") or {}).get("meters"),
        "width": (track.get("width_units") or {}).get("meters"),
        "straight": (track.get("longest_straight_units") or {}).get("meters"),
        "left": _int(track.get("left_corners")), "right": _int(track.get("right_corners")),
        "svg": (assets.get("info") or {}).get("path"), "png": (assets.get("simple") or {}).get("path"),
    }


def _rows(classification, base, grid):
    entries = classification.get("classification") or []
    field = len(entries)
    for entry in entries:
        rider = entry.get("rider") or {}
        legacy = rider.get("legacy_id")
        if legacy is None:
            continue
        pos = entry.get("position") if entry.get("status") in (None, "INSTND") else None
        yield {
            **base,
            "rider_id": legacy, "rider": rider.get("full_name"),
            "rider_country": (rider.get("country") or {}).get("iso"),
            "constructor": (entry.get("constructor") or {}).get("name"),
            "team": (entry.get("team") or {}).get("name"),
            "pos": pos, "status": entry.get("status"),
            "gap": parse_gap((entry.get("gap") or {}).get("first")),
            "grid": grid.get(legacy) if base["session"] in ("RAC", "SPR") else None,
            "field": field, "top_speed": entry.get("top_speed"),
        }


def _records(classification, event_date):
    return [{
        "type": rec.get("type"), "rider": (rec.get("rider") or {}).get("full_name"),
        "rider_id": (rec.get("rider") or {}).get("legacy_id"),
        "time": (rec.get("bestLap") or {}).get("time"), "speed": rec.get("speed"),
        "year": rec.get("year"), "date": event_date,
    } for rec in classification.get("records") or []]


async def build_dataset(fetch: Fetch, since: int = 2018, existing: Optional[dict] = None,
                        concurrency: int = 6, retry_delay: float = 2.0, min_interval: float = 0.0) -> dict:
    existing = existing or {}
    rows = list(existing.get("rows", []))
    done = set(existing.get("done", []))
    circuits = dict(existing.get("circuits", {}))
    records = {k: dict(v) for k, v in existing.get("records", {}).items()}
    sem = asyncio.Semaphore(concurrency)
    pace = {"next": 0.0}

    async def throttle():
        loop = asyncio.get_running_loop()
        now = loop.time()
        wait = max(0.0, pace["next"] - now)
        pace["next"] = max(now, pace["next"]) + min_interval
        if wait:
            await asyncio.sleep(wait)

    async def get(endpoint, default=None, attempts=5):
        for attempt in range(attempts):
            try:
                async with sem:
                    await throttle()
                    return await fetch(endpoint)
            except Exception as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                if (status == 429 or (status or 0) >= 500) and attempt < attempts - 1:
                    await asyncio.sleep(retry_delay * 2 ** attempt)  # the API rate-limits bursts
                    continue
                if default is not None:
                    return default
                raise

    seasons = [s for s in await get("/results/seasons") if s.get("year", 0) >= since]

    async def season_jobs(season):
        sid, year = season["id"], season["year"]
        cats, events, broadcast = await asyncio.gather(
            get(f"/results/categories?seasonUuid={sid}", []),
            get(f"/results/events?seasonUuid={sid}&isFinished=true", []),
            get(f"/events?seasonYear={year}", []),
        )
        by_toad = {b.get("id"): b for b in broadcast}
        jobs = []
        for event in events:
            if event.get("test"):
                continue
            circuit_id = (event.get("circuit") or {}).get("id")
            b = by_toad.get(event.get("toad_api_uuid"))
            if circuit_id and b and b.get("circuit"):
                circuits[circuit_id] = {
                    **circuit_from_broadcast(b["circuit"]),
                    "name": (event.get("circuit") or {}).get("name"), "country": (event.get("country") or {}).get("iso"),
                }
            for cat in cats:
                name = category_name(cat.get("name"))
                if name in CATEGORIES and f'{event["id"]}|{cat["id"]}' not in done:
                    jobs.append((year, event, cat["id"], name))
        return jobs

    jobs = [job for season_list in await asyncio.gather(*map(season_jobs, seasons)) for job in season_list]

    async def run(job):
        year, event, cat_id, cat_name = job
        try:
            sessions = await get(f"/results/sessions?eventUuid={event['id']}&categoryUuid={cat_id}")
            grid_raw = await get(f"/results/event/{event['id']}/category/{cat_id}/grid", [])
            grid = {(g.get("rider") or {}).get("legacy_id"): g.get("qualifying_position") for g in grid_raw}
            wanted = [s for s in sessions if s.get("type") in RESULT_SESSIONS
                      or ((s.get("condition") or {}).get("track") or "Dry").lower() != "dry"]
            results = await asyncio.gather(*(get(f"/results/session/{s['id']}/classification?test=false") for s in wanted))
        except Exception as exc:  # leave the job pending so the next build retries it
            print(f"history: skipped {event.get('short_name')} {cat_name} {year}: {exc}")
            return [], None, job, False
        new_rows = []
        event_date = event.get("date_start")
        for session, classification in zip(wanted, results):
            cond = session.get("condition") or {}
            base = {
                "year": year, "event_id": event["id"], "event": event.get("short_name"),
                "circuit_id": (event.get("circuit") or {}).get("id"), "country": (event.get("country") or {}).get("iso"),
                "date": (session.get("date") or event_date or "")[:10], "category": cat_name,
                "session": session.get("type"), "number": session.get("number"),
                "track": cond.get("track"), "air": parse_temp(cond.get("air")),
                "ground": parse_temp(cond.get("ground")), "humidity": parse_temp(cond.get("humidity")),
                "weather": cond.get("weather"),
            }
            new_rows.extend(_rows(classification, base, grid))
        race = next((c for s, c in zip(wanted, results) if s.get("type") == "RAC"), None)
        recs = _records(race, event_date) if race else None
        return new_rows, recs, job, True

    for new_rows, recs, (year, event, cat_id, cat_name), ok in await asyncio.gather(*map(run, jobs)):
        if not ok:
            continue
        rows.extend(new_rows)
        done.add(f'{event["id"]}|{cat_id}')
        circuit_id = (event.get("circuit") or {}).get("id")
        if recs and circuit_id:
            current = records.setdefault(circuit_id, {}).get(cat_name)
            if not current or (current[0].get("date") or "") <= (recs[0].get("date") or ""):
                records[circuit_id][cat_name] = recs

    return {"rows": rows, "done": sorted(done), "circuits": circuits, "records": records,
            "since": since, "built_at": datetime.now().isoformat(timespec="seconds")}


def load_dataset(path: str) -> Optional[dict]:
    if not os.path.exists(path):
        return None
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def save_dataset(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with gzip.open(tmp, "wt", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)
    os.replace(tmp, path)


from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any, Union
import httpx
import json
from datetime import datetime, timedelta
import uvicorn
import asyncio
import os
from pydantic import BaseModel
from collections import Counter
from dataclasses import dataclass, field

from fastapi.concurrency import run_in_threadpool

from analytics import (
    bike_relative_ranking, circuit_ranking, condition_ranking, consistency_ranking, dnf_rate_ranking,
    head_to_head, home_ranking, momentum_ranking, positions_gained_ranking, qualifying_ranking, rider_meta,
    sprint_vs_race_ranking,
)
from circuit_pdf import parse_circuit_pdf
from history import build_dataset, category_name, load_dataset, save_dataset
from predict import HOME_BONUS, WEIGHTS, CalibratedModel, predict_race, train_win_model
from weather import OPEN_METEO_URL, race_weekend_forecast, wet_weight

# Models
class Season(BaseModel):
    id: str
    year: int
    current: bool

class Category(BaseModel):
    id: str
    name: str
    legacy_id: int

class Event(BaseModel):
    id: str
    name: str
    sponsored_name: Optional[str] = None
    date_start: str
    date_end: str
    status: str

class Prediction(BaseModel):
    rider_id: str
    rider_name: str
    rider_number: int
    probability: float
    form: str

class ConstructorStandings(BaseModel):
    id: str
    position: int
    constructor_name: str
    points: float

class TeamStandings(BaseModel):
    id: str
    position: int
    team_name: str
    constructor_name: str
    points: float

# Initialize FastAPI app
app = FastAPI(title="MotoGP API Service")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base URL for MotoGP API
MOTOGP_API_BASE = "https://api.motogp.pulselive.com/motogp/v1"

# Create a client session
http_client = httpx.AsyncClient(timeout=30.0)

# Cache mechanism
cache = {}
CACHE_TTL = 300  # 5 minutes

def normalize_rider(rider: Dict[str, Any]) -> Dict[str, Any]:
    career = rider.get("current_career_step") or {}
    if not career:
        careers = rider.get("career") or []
        if careers:
            career = max(careers, key=lambda item: item.get("season", 0))
    team = career.get("team") or {}
    constructor = team.get("constructor") or {}
    full_name = " ".join(
        part for part in (rider.get("name"), rider.get("surname")) if part
    ).strip() or rider.get("full_name", "Unknown Rider")
    return {
        "id": rider.get("id", ""),
        "legacy_id": rider.get("legacy_id"),
        "full_name": full_name,
        "name": rider.get("name"),
        "surname": rider.get("surname"),
        "number": career.get("number"),
        "country": rider.get("country"),
        "team": team,
        "constructor": constructor,
        "position": rider.get("position"),
        "points": rider.get("points"),
        "category": career.get("category"),
        "picture": (
            (career.get("pictures") or {}).get("profile", {}).get("main")
            or rider.get("legend_picture")
            or rider.get("picture")
            or rider.get("photo")
        ),
        "number_picture": (career.get("pictures") or {}).get("number"),
        "birth_date": rider.get("birth_date"),
        "nickname": rider.get("nickname"),
        "official": career.get("type") == "Official" and career.get("in_grid") is not False,
        "birth_city": rider.get("birth_city"),
        "biography": rider.get("biography"),
        "physical_attributes": rider.get("physical_attributes"),
        "legend": rider.get("legend", False),
        "wildcard": rider.get("wildcard", False),
        "injured": rider.get("injured", False),
    }

async def get_from_api(endpoint: str):
    """Fetch data from MotoGP API with caching"""
    cache_key = endpoint
    current_time = datetime.now()
    
    # Check if data is in cache and still valid
    if cache_key in cache and cache[cache_key]["expires_at"] > current_time:
        print(f"Cache hit for {endpoint}")
        return cache[cache_key]["data"]
    
    # Make API request
    url = f"{MOTOGP_API_BASE}{endpoint}"
    print(f"Fetching from API: {url}")
    
    try:
        response = await http_client.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Store in cache with expiration time
        cache[cache_key] = {
            "data": data,
            "expires_at": current_time + timedelta(seconds=CACHE_TTL)
        }
        
        return data
    except httpx.HTTPError as e:
        print(f"HTTP error occurred: {e}")
        raise HTTPException(status_code=503, detail=f"Error fetching data from MotoGP API: {str(e)}")
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/seasons", response_model=List[Season])
async def get_seasons():
    """Get all MotoGP seasons"""
    return await get_from_api("/results/seasons")

@app.get("/api/current-season", response_model=Season)
async def get_current_season():
    """Get current season information"""
    seasons = await get_from_api("/results/seasons")
    current_season = next((season for season in seasons if season.get("current", False)), None)
    
    if not current_season:
        # If no current season found, return the latest one
        if seasons:
            latest_season = max(seasons, key=lambda x: x.get('year', 0))
            return Season(**latest_season)
        raise HTTPException(status_code=404, detail="No current season found")
    
    return Season(**current_season)

@app.get("/api/categories", response_model=List[Category])
async def get_categories(season_id: str):
    """Get categories for a season"""
    return await get_from_api(f"/results/categories?seasonUuid={season_id}")

@app.get("/api/events")
async def get_events(season_id: str, is_finished: Optional[bool] = None):
    """Get events for a season with optional finished filter"""
    endpoint = f"/results/events?seasonUuid={season_id}"
    if is_finished is not None:
        endpoint += f"&isFinished={str(is_finished).lower()}"
    
    return await get_from_api(endpoint)

@app.get("/api/upcoming-events")
async def get_upcoming_events(season_id: str):
    """Get upcoming events (not finished)"""
    return await get_events(season_id, False)

@app.get("/api/past-events")
async def get_past_events(season_id: str):
    """Get past events"""
    return await get_events(season_id, True)

@app.get("/api/sessions")
async def get_sessions(event_id: str, category_id: str):
    """Get sessions for an event and category"""
    return await get_from_api(f"/results/sessions?eventUuid={event_id}&categoryUuid={category_id}")

@app.get("/api/standings")
async def get_rider_standings(season_id: str, category_id: str):
    """Get rider standings for a season and category"""
    data = await get_from_api(f"/results/standings?seasonUuid={season_id}&categoryUuid={category_id}")
    return data.get("classification", [])

@app.get("/api/constructor-standings")
async def get_constructor_standings(season_id: str, category_id: str):
    """Get constructor standings for a season and category"""
    # First get the rider standings to calculate constructor points
    rider_data = await get_from_api(f"/results/standings?seasonUuid={season_id}&categoryUuid={category_id}")
    riders = rider_data.get("classification", [])
    
    # Group by constructor and sum points
    constructor_points = {}
    for rider in riders:
        constructor = rider.get("constructor", {})
        constructor_id = constructor.get("id", "unknown")
        constructor_name = constructor.get("name", "Unknown")
        points = rider.get("points", 0)
        
        if constructor_id not in constructor_points:
            constructor_points[constructor_id] = {
                "id": constructor_id,
                "name": constructor_name,
                "points": 0
            }
            
        constructor_points[constructor_id]["points"] += points
    
    # Convert to sorted list
    result = []
    position = 1
    for constructor_id, data in sorted(constructor_points.items(), key=lambda x: x[1]["points"], reverse=True):
        result.append({
            "id": f"constructor-{position}",
            "position": position,
            "constructor_name": data["name"],
            "points": data["points"]
        })
        position += 1
        
    return result

@app.get("/api/team-standings")
async def get_team_standings(season_id: str, category_id: str):
    """Get team standings for a season and category"""
    # First get the rider standings to calculate team points
    rider_data = await get_from_api(f"/results/standings?seasonUuid={season_id}&categoryUuid={category_id}")
    riders = rider_data.get("classification", [])
    
    # Group by team name (not ID) and sum points
    team_points = {}
    for rider in riders:
        team = rider.get("team", {})
        team_name = team.get("name", "Unknown")
        constructor_name = rider.get("constructor", {}).get("name", "Unknown")
        points = rider.get("points", 0)

        if team_name not in team_points:
            team_points[team_name] = {
                "name": team_name,
                "constructor": constructor_name,
                "points": 0
            }

        team_points[team_name]["points"] += points

    # Convert to sorted list
    result = []
    position = 1
    for team_name, data in sorted(team_points.items(), key=lambda x: x[1]["points"], reverse=True):
        result.append({
            "id": f"team-{position}",
            "position": position,
            "team_name": data["name"],
            "constructor_name": data["constructor"],
            "points": data["points"]
        })
        position += 1
        
    return result

@app.get("/api/session-results")
async def get_session_results(session_id: str):
    """Get race results for a session"""
    data = await get_from_api(f"/results/session/{session_id}/classification")
    return data.get("classification", [])

@app.get("/api/event-entries")
async def get_event_entries(event_id: str, category_id: str):
    """Get entry list for an event and category"""
    data = await get_from_api(f"/event/{event_id}/entry?categoryUuid={category_id}")
    return data.get("entry", [])

@app.get("/api/riders")
async def get_all_riders():
    """Get all riders across all categories"""
    try:
        data = await http_client.get(f"{MOTOGP_API_BASE}/riders")
        data.raise_for_status()
        riders = data.json()
        return [normalize_rider(rider) for rider in riders]
    except Exception as e:
        print(f"Error fetching riders: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch riders: {str(e)}")

@app.get("/api/riders/{rider_id}")
async def get_rider_detail(rider_id: str):
    """Get detailed information about a specific rider"""
    try:
        data = await http_client.get(f"{MOTOGP_API_BASE}/riders/{rider_id}")
        data.raise_for_status()
        normalized = normalize_rider(data.json())
        legacy_id = normalized.get("legacy_id")
        if legacy_id:
            normalized["statistics"] = await get_from_api(f"/riders/{legacy_id}/statistics")
            try:
                normalized["career_stats"] = await get_from_api(f"/riders/{legacy_id}/stats")
            except HTTPException:
                normalized["career_stats"] = None
        return normalized
    except Exception as e:
        print(f"Error fetching rider details: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to fetch rider details: {str(e)}")

@app.get("/api/standings-files")
async def get_standings_files(season_id: str, category_id: str):
    """Return official MotoGP documents linked to championship and circuit records."""
    return await get_from_api(
        f"/results/standings/files?seasonUuid={season_id}&categoryUuid={category_id}"
    )

@app.get("/api/events/{event_id}")
async def get_event_detail(event_id: str):
    """Get detailed information about a specific event"""
    return await find_event(event_id)

@app.get("/api/live-timing")
async def get_live_timing():
    """Get live timing data"""
    try:
        # Fetch from live timing API
        data = await http_client.get("https://api.motogp.pulselive.com/motogp/v1/timing-gateway/livetiming-lite")
        data.raise_for_status()
        payload = data.json()
        head = payload.get("head", {})
        active_statuses = {"L", "LIVE", "S", "STARTED", "R"}
        is_active = (
            str(head.get("session_status_id", "")).upper() in active_statuses
            or str(head.get("session_status_name", "")).upper() in active_statuses
        )
        return {"active": is_active, "head": head, "rider": payload.get("rider", []) if is_active else []}
    except Exception as e:
        print(f"Error fetching live timing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch live timing data: {str(e)}")

# ---------------------------------------------------------------------------
# Insights: cached history dataset, rider rankings, circuit sheet, predictions
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_PATH = os.path.join(DATA_DIR, "history.json.gz")
MODEL_PATH = os.path.join(DATA_DIR, "model.json")
HISTORY_SINCE = 2018
# rankings built on fewer races than this are noise (wildcards, replacements)
MIN_SAMPLES = {"positions": 5, "consistency": 5, "reliability": 5, "sprint": 5, "qualifying": 5, "bike": 3, "home": 2}
REFRESH_SECONDS = 6 * 3600
FORECAST_TTL = 3600


@dataclass
class InsightsState:
    data: Optional[dict] = None
    model: Optional[CalibratedModel] = None
    building: bool = False
    error: Optional[str] = None
    cache: Dict[Any, Any] = field(default_factory=dict)

    @property
    def rows(self) -> List[dict]:
        return (self.data or {}).get("rows", [])


def load_model(data: Optional[dict]) -> Optional[CalibratedModel]:
    if not data or not os.path.exists(MODEL_PATH):
        return None
    with open(MODEL_PATH, encoding="utf-8") as fh:
        stored = json.load(fh)
    if "temperature" not in stored or stored.get("meta", {}).get("rows") != len(data["rows"]):
        return None
    return CalibratedModel.from_dict(stored)


def train_and_save_model(data: dict) -> Optional[CalibratedModel]:
    model = train_win_model(data["rows"])
    if model:
        model.meta["rows"] = len(data["rows"])
        with open(MODEL_PATH, "w", encoding="utf-8") as fh:
            json.dump(model.to_dict(), fh)
    return model


_initial = load_dataset(DATA_PATH)
STATE = InsightsState(data=_initial, model=load_model(_initial))


async def api_fetch(endpoint: str):
    response = await http_client.get(f"{MOTOGP_API_BASE}{endpoint}")
    response.raise_for_status()
    return response.json()


async def refresh_dataset() -> None:
    STATE.building = True
    try:
        data = await build_dataset(api_fetch, since=HISTORY_SINCE, existing=STATE.data, concurrency=4, min_interval=0.25)
        await run_in_threadpool(save_dataset, DATA_PATH, data)
        STATE.data, STATE.error = data, None
        STATE.cache.clear()
        STATE.model = load_model(data) or await run_in_threadpool(train_and_save_model, data)
    except Exception as exc:  # keep serving the previous dataset
        print(f"insights: refresh failed: {exc}")
        STATE.error = str(exc)
    finally:
        STATE.building = False


async def refresh_loop() -> None:
    while True:
        await refresh_dataset()
        await asyncio.sleep(REFRESH_SECONDS)


def start_background_refresh() -> None:
    asyncio.get_running_loop().create_task(refresh_loop())


@app.on_event("startup")
async def on_startup():
    start_background_refresh()


def require_data() -> dict:
    if not STATE.data or not STATE.rows:
        raise HTTPException(status_code=503, detail="Historical dataset is still being built, retry in a few minutes")
    return STATE.data


def cached(key, compute):
    if key not in STATE.cache:
        STATE.cache[key] = compute()
    return STATE.cache[key]


def grid_rows(category: str):
    """All history rows of the riders entered in `category` in the latest season."""
    rows = STATE.rows
    year = max((r["year"] for r in rows), default=0)
    current = {r["rider_id"] for r in rows if r["year"] == year and r["category"] == category}
    return [r for r in rows if r["rider_id"] in current], year


def circuit_families(circuits: dict) -> Dict[str, List[str]]:
    measured = sorted((c["straight"], cid) for cid, c in circuits.items() if c.get("straight"))
    k = max(1, len(measured) // 3)
    return {
        "fast": [cid for _, cid in measured[-k:]],
        "technical": [cid for _, cid in measured[:k]],
        "left": [cid for cid, c in circuits.items() if (c.get("left") or 0) > (c.get("right") or 0)],
        "right": [cid for cid, c in circuits.items() if (c.get("right") or 0) > (c.get("left") or 0)],
    }


def rankings_bundle(category: str) -> dict:
    def compute():
        rows, year = grid_rows(category)
        cat_rows = [r for r in rows if r["category"] == category]
        families = circuit_families(STATE.data.get("circuits", {}))
        rankings = {cond: condition_ranking(rows, cond) for cond in ("wet", "dry", "hot", "cold")}
        rankings.update({
            "bike": bike_relative_ranking(cat_rows, since=year),
            "qualifying": qualifying_ranking(cat_rows, since=year - 1),
            "positions": positions_gained_ranking(cat_rows, since=year - 1),
            "consistency": consistency_ranking(cat_rows, since=year - 1),
            "reliability": dnf_rate_ranking(cat_rows, since=year - 1),
            "sprint": sprint_vs_race_ranking(cat_rows, since=year - 1),
            "momentum": momentum_ranking(cat_rows, year=year, last=5),
            "home": home_ranking(rows),
        })
        rankings.update({name: circuit_ranking(rows, ids) for name, ids in families.items()})
        for key, minimum in MIN_SAMPLES.items():
            kept = [item for item in rankings[key] if item["n"] >= minimum]
            for i, item in enumerate(kept, 1):
                item["rank"] = i
            rankings[key] = kept
        return {"category": category, "year": year, "built_at": STATE.data.get("built_at"), "rankings": rankings}
    return cached(("rankings", category), compute)


@app.get("/api/insights/status")
async def insights_status():
    data = STATE.data or {}
    return {"ready": bool(STATE.rows), "rows": len(STATE.rows), "built_at": data.get("built_at"),
            "since": data.get("since"), "building": STATE.building, "error": STATE.error,
            "model": STATE.model.meta if STATE.model else None}


@app.post("/api/insights/refresh")
async def insights_refresh():
    if not STATE.building:
        asyncio.get_running_loop().create_task(refresh_dataset())
    return {"building": True}


@app.get("/api/insights/rankings")
async def insights_rankings(category: str = "MotoGP"):
    require_data()
    return await run_in_threadpool(rankings_bundle, category)


def rider_profile(rider_id: int) -> Optional[dict]:
    rows = [r for r in STATE.rows if r["rider_id"] == rider_id]
    if not rows:
        return None
    meta = rider_meta(rows)
    bundle = rankings_bundle(meta["category"])
    ranks = {}
    for key, items in bundle["rankings"].items():
        item = next((i for i in items if i["rider_id"] == rider_id), None)
        if item:
            ranks[key] = {**{k: v for k, v in item.items() if k not in ("rider", "rider_country", "team", "category")},
                          "of": len(items)}
    races = [r for r in rows if r["session"] in ("RAC", "SPR")]
    circuits = STATE.data.get("circuits", {})
    by_circuit = {}
    for r in races:
        c = by_circuit.setdefault(r["circuit_id"], {"circuit_id": r["circuit_id"], "event": r["event"], "results": []})
        c["results"].append({"year": r["year"], "session": r["session"], "category": r["category"],
                             "pos": r["pos"], "track": r["track"]})
    circuit_list = []
    for cid, c in by_circuit.items():
        finished = [x["pos"] for x in c["results"] if x["pos"]]
        circuit_list.append({**c, "name": (circuits.get(cid) or {}).get("name"),
                             "best": min(finished) if finished else None,
                             "avg": round(sum(finished) / len(finished), 2) if finished else None,
                             "wins": finished.count(1), "podiums": sum(1 for p in finished if p <= 3),
                             "starts": len(c["results"])})
    circuit_list.sort(key=lambda c: (c["avg"] is None, c["avg"] or 99))
    seasons = {}
    for r in races:
        s = seasons.setdefault((r["year"], r["category"]), {"year": r["year"], "category": r["category"],
                                                           "starts": 0, "wins": 0, "podiums": 0, "dnf": 0, "positions": []})
        s["starts"] += 1
        if r["pos"] is None:
            s["dnf"] += 1
        else:
            s["positions"].append(r["pos"])
            s["wins"] += r["pos"] == 1
            s["podiums"] += r["pos"] <= 3
    season_list = []
    for s in sorted(seasons.values(), key=lambda s: (s["year"], s["category"])):
        positions = s.pop("positions")
        season_list.append({**s, "avg": round(sum(positions) / len(positions), 2) if positions else None})
    highlights = sorted(((k, v) for k, v in ranks.items() if v.get("n", 0) >= 2),
                        key=lambda kv: kv[1]["rank"] / max(kv[1]["of"], 1))[:4]
    return {**meta, "ranks": ranks, "highlights": [{"key": k, **v} for k, v in highlights],
            "circuits": circuit_list, "seasons": season_list, "year": bundle["year"]}


@app.get("/api/insights/rider/{rider_id}")
async def insights_rider(rider_id: int):
    require_data()
    profile = await run_in_threadpool(rider_profile, rider_id)
    if not profile:
        raise HTTPException(status_code=404, detail="No history for this rider")
    return profile


@app.get("/api/insights/h2h")
async def insights_head_to_head(a: int, b: int):
    require_data()
    return head_to_head(STATE.rows, a, b)


async def find_event(event_id: str) -> dict:
    """Current season first, then older seasons newest-first (most lookups are recent)."""
    seasons = sorted(await get_from_api("/results/seasons"), key=lambda s: s.get("year", 0), reverse=True)
    for season in seasons:
        events = await get_from_api(f"/results/events?seasonUuid={season['id']}")
        event = next((item for item in events if item.get("id") == event_id), None)
        if event:
            return event
    raise HTTPException(status_code=404, detail="Event not found")


async def weekend_forecast(event: dict, circuit: Optional[dict]) -> List[dict]:
    if not circuit or circuit.get("lat") is None:
        return []
    key = ("forecast", event["id"])
    hit = STATE.cache.get(key)
    if hit and hit[0] > datetime.now():
        return hit[1]
    try:
        response = await http_client.get(OPEN_METEO_URL.format(lat=circuit["lat"], lng=circuit["lng"]))
        response.raise_for_status()
        days = race_weekend_forecast(response.json(), event.get("date_start", ""), event.get("date_end", ""))
    except Exception as exc:
        print(f"weather: forecast unavailable: {exc}")
        days = []
    STATE.cache[key] = (datetime.now() + timedelta(seconds=FORECAST_TTL), days)
    return days


def past_conditions(circuit_id: str) -> List[dict]:
    seen = {}
    for r in STATE.rows:
        if r["circuit_id"] == circuit_id and r["category"] == "MotoGP" and r["session"] in ("RAC", "SPR"):
            seen[(r["year"], r["session"])] = {k: r.get(k) for k in ("year", "session", "track", "air", "ground", "humidity", "weather")}
    return sorted(seen.values(), key=lambda c: (c["year"], c["session"]), reverse=True)


@app.get("/api/weather")
async def get_weather(event_id: str):
    data = require_data()
    event = await find_event(event_id)
    circuit_id = (event.get("circuit") or {}).get("id")
    days = await weekend_forecast(event, data.get("circuits", {}).get(circuit_id))
    return {"days": days, "wet_weight": wet_weight(days, None), "history": past_conditions(circuit_id)}


async def circuit_pdf_records(event: dict, circuit_id: str) -> dict:
    url = ((event.get("event_files") or {}).get("circuit_information") or {}).get("url")
    if not url:  # upcoming event: use the latest past edition held on the same circuit
        past = max(((r["year"], r["event"]) for r in STATE.rows if r["circuit_id"] == circuit_id), default=None)
        if not past:
            return {}
        url = f"https://resources.motogp.com/files/results/{past[0]}/{past[1]}/CircuitInformation.pdf"
    key = ("pdf", url)
    if key not in STATE.cache:
        try:
            response = await http_client.get(url)
            response.raise_for_status()
            STATE.cache[key] = {**await run_in_threadpool(parse_circuit_pdf, response.content), "url": url}
        except Exception as exc:
            print(f"circuit pdf: {url}: {exc}")
            return {"url": url}
    return STATE.cache[key]


def circuit_history(circuit_id: str) -> dict:
    podiums = {}
    for r in STATE.rows:
        if r["circuit_id"] == circuit_id and r["session"] == "RAC" and r["pos"] and r["pos"] <= 3:
            edition = podiums.setdefault((r["year"], r["category"]), {"year": r["year"], "category": r["category"],
                                                                      "event": r["event"], "track": r["track"], "podium": []})
            edition["podium"].append({"pos": r["pos"], "rider": r["rider"], "rider_id": r["rider_id"],
                                      "constructor": r["constructor"], "gap": r.get("gap")})
    editions = sorted(podiums.values(), key=lambda e: (-e["year"], e["category"]))
    for e in editions:
        e["podium"].sort(key=lambda p: p["pos"])
    wins = Counter(p["rider"] for e in editions if e["category"] == "MotoGP" for p in e["podium"] if p["pos"] == 1)
    bikes = Counter(p["constructor"] for e in editions if e["category"] == "MotoGP" for p in e["podium"] if p["pos"] == 1)
    return {"editions": editions, "top_winners": wins.most_common(5), "top_constructors": bikes.most_common(5)}


@app.get("/api/circuit/{event_id}")
async def get_circuit(event_id: str):
    data = require_data()
    event = await find_event(event_id)
    circuit_id = (event.get("circuit") or {}).get("id")
    rows, _ = grid_rows("MotoGP")
    specialists = await run_in_threadpool(circuit_ranking, rows, [circuit_id])
    return {
        "event": {k: event.get(k) for k in ("id", "name", "sponsored_name", "short_name", "date_start", "date_end", "status")},
        "circuit": {**(data.get("circuits", {}).get(circuit_id) or {}), "id": circuit_id,
                    "name": (event.get("circuit") or {}).get("name"), "place": (event.get("circuit") or {}).get("place")},
        "api_records": data.get("records", {}).get(circuit_id, {}),
        "pdf": await circuit_pdf_records(event, circuit_id),
        "history": circuit_history(circuit_id),
        "conditions": past_conditions(circuit_id),
        "specialists": specialists[:10],
        "files": event.get("event_files") or {},
    }


@app.get("/api/predictions")
async def get_predictions(event_id: str, category_id: str, scenario: Optional[str] = None):
    """Race prediction from the cached history, the championship and the weekend forecast."""
    data = require_data()
    seasons = await get_from_api("/results/seasons")
    current_season = next((s for s in seasons if s.get("current")), seasons[0])
    event = await find_event(event_id)
    categories = await get_from_api(f"/results/categories?seasonUuid={current_season['id']}")
    category = category_name(next((c["name"] for c in categories if c["id"] == category_id), "MotoGP"))
    standings = (await get_from_api(
        f"/results/standings?seasonUuid={current_season['id']}&categoryUuid={category_id}")).get("classification", [])
    entrants = [{
        "rider_id": (s.get("rider") or {}).get("legacy_id"), "rider": (s.get("rider") or {}).get("full_name"),
        "number": (s.get("rider") or {}).get("number"), "rider_uuid": (s.get("rider") or {}).get("riders_api_uuid"),
        "rider_country": ((s.get("rider") or {}).get("country") or {}).get("iso"),
        "constructor": (s.get("constructor") or {}).get("name"), "team": (s.get("team") or {}).get("name"),
        "points": float(s.get("points") or 0), "position": s.get("position"),
    } for s in standings if (s.get("rider") or {}).get("legacy_id")]
    if not entrants:
        raise HTTPException(status_code=404, detail="No standings found for this category")

    circuit_id = (event.get("circuit") or {}).get("id")
    days = await weekend_forecast(event, data.get("circuits", {}).get(circuit_id))
    weight = wet_weight(days, scenario)
    model = STATE.model if category == "MotoGP" else None

    def compute():
        ids = {e["rider_id"] for e in entrants}
        rows = [r for r in STATE.rows if r["rider_id"] in ids]
        return predict_race(rows, entrants, circuit_id, category, current_season["year"], weight,
                            (event.get("country") or {}).get("iso"), model)

    predictions = await run_in_threadpool(cached, ("predict", event_id, category, weight, data.get("built_at")), compute)
    return {
        "event": {k: event.get(k) for k in ("id", "name", "sponsored_name", "short_name", "date_start", "date_end")},
        "category": category,
        "weather": {"days": days, "wet_weight": weight, "scenario": scenario or "forecast"},
        "weights": WEIGHTS, "home_bonus": HOME_BONUS,
        "model": model.meta if model else None,
        "predictions": predictions,
    }


@app.get("/api/calendar-ics")
async def generate_calendar(event_id: str):
    """Generate iCalendar file for a specific event"""
    try:
        # Get the event details
        event_data = None
        seasons = await get_seasons()
        
        # We need to search through seasons to find the event
        for season in seasons:
            try:
                events = await get_events(season["id"])
                event = next((e for e in events if e["id"] == event_id), None)
                if event:
                    event_data = event
                    break
            except:
                continue
        
        if not event_data:
            raise HTTPException(status_code=404, detail="Event not found")
            
        # Basic iCalendar format
        start_date = datetime.fromisoformat(event_data["date_start"].replace("Z", "+00:00"))
        end_date = datetime.fromisoformat(event_data["date_end"].replace("Z", "+00:00"))
        
        event_name = event_data.get("sponsored_name") or event_data.get("name", "MotoGP Event")
        location = f"{event_data.get('circuit', {}).get('name', '')}, {event_data.get('country', {}).get('name', '')}"
        
        # Create iCalendar content
        ical_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MotoGP Race Insights//EN
BEGIN:VEVENT
UID:{event_id}@motogp-insights.com
DTSTAMP:{datetime.now().strftime("%Y%m%dT%H%M%SZ")}
DTSTART:{start_date.strftime("%Y%m%dT%H%M%SZ")}
DTEND:{end_date.strftime("%Y%m%dT%H%M%SZ")}
SUMMARY:{event_name}
LOCATION:{location}
DESCRIPTION:MotoGP race event at {location}
END:VEVENT
END:VCALENDAR
"""
        return {"ical": ical_content, "eventName": event_name}
    
    except Exception as e:
        print(f"Error generating calendar: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate calendar: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

import asyncio

from history import build_dataset

SEASON = "s26"
CAT = "cat-gp"
EVENT = "ev1"


def _rider(legacy, name, iso="FR"):
    return {"id": f"u{legacy}", "full_name": name, "legacy_id": legacy, "country": {"iso": iso}}


def _entry(pos, legacy, name, status="INSTND", gap="0.000", constructor="Yamaha", top_speed=None):
    return {
        "position": pos, "rider": _rider(legacy, name), "team": {"name": "Team"},
        "constructor": {"name": constructor}, "gap": {"first": gap}, "status": status,
        "top_speed": top_speed,
    }


def _session(sid, typ, track="Dry", number=None):
    return {"id": sid, "type": typ, "number": number, "date": "2026-03-01T13:00:00+07:00",
            "condition": {"track": track, "air": "30º", "ground": "48º", "weather": "Clear"}}


API = {
    "/results/seasons": [{"id": SEASON, "year": 2026, "current": True}, {"id": "old", "year": 2010, "current": False}],
    f"/results/categories?seasonUuid={SEASON}": [{"id": CAT, "name": "MotoGP™"}, {"id": "cat-e", "name": "MotoE™"}],
    f"/results/events?seasonUuid={SEASON}&isFinished=true": [
        {"id": EVENT, "short_name": "THA", "test": False, "date_start": "2026-02-27",
         "country": {"iso": "TH"}, "circuit": {"id": "circ1", "name": "Chang"}, "toad_api_uuid": "b1",
         "season": {"year": 2026}},
        {"id": "test1", "short_name": "TH1", "test": True, "date_start": "2026-02-20",
         "country": {"iso": "TH"}, "circuit": {"id": "circ1"}, "toad_api_uuid": "b0"},
    ],
    "/events?seasonYear=2026": [
        {"id": "b1", "circuit": {"lat": "14.9", "lng": "103.0", "track": {
            "lenght_units": {"meters": 4554}, "longest_straight_units": {"meters": 1000},
            "left_corners": "5", "right_corners": "7",
            "assets": {"info": {"path": "https://x/info.svg"}, "simple": {"path": "https://x/simple.png"}}}}},
    ],
    f"/results/sessions?eventUuid={EVENT}&categoryUuid={CAT}": [
        _session("rac", "RAC"), _session("fp-dry", "FP", number=1), _session("fp-wet", "FP", "Wet", number=2),
    ],
    "/results/session/rac/classification?test=false": {"classification": [
        _entry(1, 20, "Fabio Quartararo", top_speed=340.1), _entry(2, 5, "Johann Zarco", gap="1.500"),
        _entry(None, 42, "Alex Rins", status="OUTSTND", gap=None),
    ], "records": [{"type": "recordLap", "rider": _rider(20, "Fabio Quartararo"), "bestLap": {"time": "01:28.526"}, "speed": "185.1", "year": 2026}]},
    "/results/session/fp-wet/classification?test=false": {"classification": [_entry(1, 5, "Johann Zarco")]},
    f"/results/event/{EVENT}/category/{CAT}/grid": [
        {"rider": _rider(20, "Fabio Quartararo"), "qualifying_position": 3},
        {"rider": _rider(5, "Johann Zarco"), "qualifying_position": 1},
    ],
}


def make_fetch(calls):
    async def fetch(endpoint):
        calls.append(endpoint)
        if endpoint not in API:
            raise KeyError(endpoint)
        return API[endpoint]
    return fetch


def build(existing=None, calls=None):
    return asyncio.run(build_dataset(make_fetch(calls if calls is not None else []), since=2018, existing=existing))


def test_builds_rows_for_races_and_wet_practice_only():
    data = build()
    sessions = sorted({r["session"] + ("-wet" if r["track"] == "Wet" else "") for r in data["rows"]})
    assert sessions == ["FP-wet", "RAC"]
    assert len(data["rows"]) == 4


def test_row_fields_are_normalised():
    rows = {(r["session"], r["rider_id"]): r for r in build()["rows"]}
    q = rows[("RAC", 20)]
    assert q["category"] == "MotoGP" and q["year"] == 2026 and q["event"] == "THA"
    assert q["ground"] == 48 and q["air"] == 30 and q["country"] == "TH"
    assert q["grid"] == 3 and q["field"] == 3 and q["top_speed"] == 340.1
    assert rows[("RAC", 5)]["gap"] == 1.5
    assert rows[("RAC", 42)]["pos"] is None


def test_skips_tests_old_seasons_and_unlisted_categories():
    calls = []
    build(calls=calls)
    assert not any("test1" in c or "old" in c or "cat-e" in c for c in calls)


def test_collects_circuit_geometry_and_records():
    data = build()
    circuit = data["circuits"]["circ1"]
    assert circuit["length"] == 4554 and circuit["straight"] == 1000
    assert circuit["left"] == 5 and circuit["right"] == 7
    assert circuit["lat"] == 14.9 and circuit["svg"] == "https://x/info.svg"
    assert data["records"]["circ1"]["MotoGP"][0]["time"] == "01:28.526"


def test_incremental_build_skips_known_events():
    first = build()
    calls = []
    second = build(existing=first, calls=calls)
    assert not any("classification" in c for c in calls)
    assert len(second["rows"]) == len(first["rows"])


class RateLimited(Exception):
    def __init__(self):
        super().__init__("429")
        self.response = type("R", (), {"status_code": 429, "headers": {}})()


def test_retries_rate_limited_requests():
    failures = {"left": 2}
    calls = []

    async def flaky(endpoint):
        if "classification" in endpoint and failures["left"]:
            failures["left"] -= 1
            raise RateLimited()
        return await make_fetch(calls)(endpoint)

    data = asyncio.run(build_dataset(flaky, since=2018, retry_delay=0))
    assert len(data["rows"]) == 4

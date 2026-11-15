import pytest
from fastapi.testclient import TestClient

import main


def row(**kw):
    base = {"year": 2026, "event_id": "e1", "event": "AAA", "circuit_id": "c1", "country": "IT", "date": "2026-05-01",
            "category": "MotoGP", "session": "RAC", "number": None, "track": "Dry", "air": 20, "ground": 30,
            "rider_id": 20, "rider": "Fabio Quartararo", "rider_country": "FR", "constructor": "Yamaha",
            "team": "Yamaha", "pos": 1, "status": "INSTND", "gap": 0.0, "grid": 1, "field": 3}
    base.update(kw)
    return base


def dataset():
    rows = []
    for i in range(6):
        ev = dict(event_id=f"e{i}", date=f"2026-0{1 + i}-01", track="Wet" if i < 2 else "Dry")
        rows += [row(**ev, rider_id=20, pos=1 if i < 2 else 2),
                 row(**ev, rider_id=5, rider="Johann Zarco", constructor="Honda", pos=3 if i < 2 else 1),
                 row(**ev, rider_id=42, rider="Alex Rins", pos=2 if i < 2 else 3)]
    return {"rows": rows, "done": [], "since": 2018, "built_at": "2026-11-15T10:00:00",
            "circuits": {"c1": {"name": "Mugello", "length": 5245, "straight": 1141, "left": 6, "right": 9,
                                "lat": 43.99, "lng": 11.37, "svg": "https://x/c1.svg", "png": None}},
            "records": {"c1": {"MotoGP": [{"type": "recordLap", "rider": "Fabio Quartararo", "time": "01:45.187"}]}}}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, "STATE", main.InsightsState(data=dataset()))
    monkeypatch.setattr(main, "start_background_refresh", lambda: None)
    with TestClient(main.app) as c:
        yield c


def test_status_reports_dataset(client):
    body = client.get("/api/insights/status").json()
    assert body["ready"] is True and body["rows"] == 18


def test_rankings_bundle_covers_every_dimension(client):
    body = client.get("/api/insights/rankings?category=MotoGP").json()
    for key in ("wet", "dry", "hot", "cold", "bike", "qualifying", "positions", "consistency",
                "reliability", "sprint", "momentum", "home", "fast", "technical"):
        assert key in body["rankings"], key
    assert body["rankings"]["wet"][0]["rider"] == "Fabio Quartararo"


def test_rankings_unknown_category_is_empty_not_error(client):
    assert client.get("/api/insights/rankings?category=MotoE").json()["rankings"]["wet"] == []


def test_rider_profile_lists_rank_in_each_ranking(client):
    body = client.get("/api/insights/rider/5").json()
    assert body["rider"] == "Johann Zarco"
    assert body["ranks"]["dry"]["rank"] == 1
    assert body["ranks"]["dry"]["of"] == 3
    assert body["circuits"][0]["circuit_id"] == "c1"


def test_rider_profile_404(client):
    assert client.get("/api/insights/rider/999").status_code == 404


def test_head_to_head(client):
    body = client.get("/api/insights/h2h?a=20&b=5").json()
    assert body["total"]["n"] == 6 and body["wet"] == {"a": 2, "b": 0, "n": 2}


def test_insights_not_ready_returns_503(monkeypatch):
    monkeypatch.setattr(main, "STATE", main.InsightsState(data=None))
    monkeypatch.setattr(main, "start_background_refresh", lambda: None)
    with TestClient(main.app) as c:
        assert c.get("/api/insights/rankings").status_code == 503


def test_rankings_drop_riders_below_sample_threshold(client, monkeypatch):
    data = dataset()
    data["rows"].append(row(event_id="wild", rider_id=99, rider="Wildcard", pos=1, grid=3, date="2026-07-01"))
    monkeypatch.setattr(main, "STATE", main.InsightsState(data=data))
    body = client.get("/api/insights/rankings?category=MotoGP").json()
    for key in ("positions", "consistency", "reliability"):
        assert 99 not in [i["rider_id"] for i in body["rankings"][key]], key

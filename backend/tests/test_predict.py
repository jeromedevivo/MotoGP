import pytest

from predict import WEIGHTS, CalibratedModel, fit_temperature, predict_race, simulate_positions


def row(**kw):
    base = {"year": 2026, "event_id": "e", "category": "MotoGP", "session": "RAC", "number": None,
            "track": "Dry", "ground": 30, "circuit_id": "c-other", "country": "IT", "date": "2026-05-01",
            "rider_id": 1, "rider": "A", "rider_country": "FR", "constructor": "Ducati", "team": "T",
            "pos": 1, "grid": 1, "field": 4}
    base.update(kw)
    return base


def season(results, **kw):
    """results: {rider_id: [pos per race]} -> rows for consecutive races."""
    rows = []
    for rider_id, positions in results.items():
        for i, pos in enumerate(positions):
            rows.append(row(event_id=f"e{i}", date=f"2026-0{1 + i // 28}-{1 + i % 28:02d}",
                            rider_id=rider_id, rider=f"R{rider_id}", pos=pos, grid=pos, **kw))
    return rows


ENTRANTS = [{"rider_id": i, "rider": f"R{i}", "constructor": "Ducati", "team": "T", "rider_country": "FR",
             "points": p} for i, p in ((1, 300), (2, 150), (3, 100), (4, 50))]


def predict(rows, **kw):
    args = {"entrants": ENTRANTS, "circuit_id": "c1", "category": "MotoGP", "year": 2026,
            "wet_weight": 0.0, "event_country": "IT"}
    args.update(kw)
    return {p["rider_id"]: p for p in predict_race(rows, **args)}


def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_dominant_rider_is_favourite_and_probabilities_are_consistent():
    preds = predict(season({1: [1] * 6, 2: [2] * 6, 3: [3] * 6, 4: [4] * 6}))
    assert max(preds.values(), key=lambda p: p["win"])["rider_id"] == 1
    assert sum(p["win"] for p in preds.values()) == pytest.approx(1.0, abs=1e-6)
    assert sum(p["podium"] for p in preds.values()) == pytest.approx(3.0, abs=0.05)
    for p in preds.values():
        assert p["win"] <= p["podium"] <= 1.0
        assert set(WEIGHTS) <= set(p["factors"])


def test_wet_scenario_promotes_rain_specialist():
    rows = season({1: [1] * 6, 2: [2] * 6, 3: [3] * 6, 4: [4] * 6})
    for i in range(4):  # rider 4 wins every wet race, rider 1 struggles
        rows += [row(event_id=f"w{i}", date=f"2025-06-0{i + 1}", year=2025, track="Wet", rider_id=4, pos=1),
                 row(event_id=f"w{i}", date=f"2025-06-0{i + 1}", year=2025, track="Wet", rider_id=1, pos=4)]
    dry = predict(rows, wet_weight=0.0)
    wet = predict(rows, wet_weight=1.0)
    assert wet[4]["win"] > dry[4]["win"]
    assert wet[1]["win"] < dry[1]["win"]
    assert wet[4]["factors"]["condition"] > wet[1]["factors"]["condition"]


def test_circuit_specialist_gets_circuit_factor():
    rows = season({1: [2] * 6, 2: [1] * 6, 3: [3] * 6, 4: [4] * 6})
    rows += [row(event_id=f"c{i}", year=2020 + i, date=f"202{i}-04-01", circuit_id="c1", rider_id=3, pos=1) for i in range(4)]
    preds = predict(rows)
    assert preds[3]["factors"]["circuit"] == max(p["factors"]["circuit"] for p in preds.values())
    assert preds[3]["circuit_results"]


def test_rookie_without_history_gets_neutral_factors():
    entrants = ENTRANTS + [{"rider_id": 99, "rider": "Rookie", "constructor": "KTM", "team": "T",
                            "rider_country": "ES", "points": 0}]
    preds = predict(season({1: [1] * 3}), entrants=entrants)
    assert 0 < preds[99]["win"] < preds[1]["win"]
    assert preds[99]["factors"]["circuit"] == pytest.approx(0.5)


def test_home_rider_flagged():
    entrants = [dict(e, rider_country="IT") if e["rider_id"] == 2 else e for e in ENTRANTS]
    preds = predict(season({1: [1] * 6, 2: [2] * 6}), entrants=entrants)
    assert preds[2]["home"] is True and preds[1]["home"] is False


def test_simulation_is_deterministic_and_bounded():
    a = simulate_positions([0.5, 0.3, 0.2], runs=500, seed=1)
    b = simulate_positions([0.5, 0.3, 0.2], runs=500, seed=1)
    assert a == b
    assert a[0]["podium"] == pytest.approx(1.0)  # only three riders
    assert a[0]["expected"] < a[2]["expected"]


def test_fit_temperature_is_sharper_when_favourites_win():
    favourites_win = [([0.9, 0.5, 0.4, 0.3], 0)] * 20
    random_winner = [([0.9, 0.5, 0.4, 0.3], i % 4) for i in range(20)]
    assert fit_temperature(favourites_win) > fit_temperature(random_winner)


def test_calibrated_model_changes_sharpness():
    rows = season({1: [1] * 6, 2: [2] * 6, 3: [3] * 6, 4: [4] * 6})
    soft = predict(rows, model=CalibratedModel(temperature=2.0))
    sharp = predict(rows, model=CalibratedModel(temperature=40.0))
    assert sharp[1]["win"] > soft[1]["win"]

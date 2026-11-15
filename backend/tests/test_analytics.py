import pytest

from analytics import (
    bike_relative_ranking,
    condition_ranking,
    dnf_rate_ranking,
    head_to_head,
    home_ranking,
    lap_seconds,
    momentum_ranking,
    parse_gap,
    parse_temp,
    positions_gained_ranking,
    result_score,
    shrink,
    sprint_vs_race_ranking,
)


def row(**kw):
    base = {
        "year": 2025, "event_id": "e1", "event": "AAA", "circuit_id": "c1", "country": "IT",
        "date": "2025-05-01", "category": "MotoGP", "session": "RAC", "track": "Dry",
        "air": 20, "ground": 30, "weather": "Clear", "rider_id": 1, "rider": "A",
        "rider_country": "FR", "constructor": "Ducati", "team": "T", "pos": 1,
        "status": "INSTND", "gap": 0.0, "grid": 1, "field": 20, "top_speed": None,
    }
    base.update(kw)
    return base


def by_id(ranking):
    return {item["rider_id"]: item for item in ranking}


# --- parsing helpers -------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [("0.000", 0.0), ("1.234", 1.234), ("+1.234", 1.234), ("1 Lap", None), (None, None), ("", None)])
def test_parse_gap(raw, expected):
    assert parse_gap(raw) == expected


@pytest.mark.parametrize("raw,expected", [("35º", 35), ("17°", 17), ("8", 8), (None, None), ("n/a", None)])
def test_parse_temp(raw, expected):
    assert parse_temp(raw) == expected


@pytest.mark.parametrize("raw,expected", [("01:30.637", 90.637), ("1'28.526", 88.526), ("39:36.270", 2376.27)])
def test_lap_seconds(raw, expected):
    assert lap_seconds(raw) == pytest.approx(expected)


@pytest.mark.parametrize("raw", [None, "", "DNF"])
def test_lap_seconds_invalid(raw):
    assert lap_seconds(raw) is None


def test_result_score_bounds():
    assert result_score(1, 20) == 1.0
    assert result_score(20, 20) == 0.0
    assert result_score(None, 20) is None
    assert result_score(1, 1) == 1.0


def test_shrink_pulls_small_samples_to_prior():
    assert shrink(1.0, 1, 0.5, k=3) == pytest.approx(0.625)
    assert shrink(0.9, 0, 0.4, k=3) == pytest.approx(0.4)


# --- condition rankings ----------------------------------------------------

def test_wet_ranking_rewards_rain_specialist():
    rows = []
    for i in range(4):
        ev = f"w{i}"
        rows += [row(event_id=ev, track="Wet", rider_id=1, pos=1), row(event_id=ev, track="Wet", rider_id=2, pos=20, rider="B")]
        ev = f"d{i}"
        rows += [row(event_id=ev, rider_id=1, pos=20), row(event_id=ev, rider_id=2, pos=1, rider="B")]
    ranking = condition_ranking(rows, "wet")
    assert [r["rider_id"] for r in ranking] == [1, 2]
    assert by_id(ranking)[1]["n"] == 4
    assert by_id(ranking)[1]["delta"] > 0 > by_id(ranking)[2]["delta"]


def test_single_wet_practice_does_not_beat_proven_wet_racer():
    rows = [row(event_id="x", session="FP", track="Wet", rider_id=9, pos=1, rider="Lucky")]
    rows += [row(event_id="x2", track="Dry", rider_id=9, pos=15, rider="Lucky")]
    for i in range(5):
        rows.append(row(event_id=f"w{i}", track="Wet", rider_id=1, pos=2))
    assert condition_ranking(rows, "wet")[0]["rider_id"] == 1


def test_condition_ranking_filters_category_and_counts_dnf_as_zero():
    rows = [
        row(track="Wet", rider_id=1, pos=None, status="OUTSTND"),
        row(track="Wet", rider_id=2, pos=5),
        row(track="Wet", rider_id=3, pos=1, category="Moto2"),
    ]
    ranking = condition_ranking(rows, "wet", category="MotoGP")
    assert {r["rider_id"] for r in ranking} == {1, 2}
    assert by_id(ranking)[2]["score"] > by_id(ranking)[1]["score"]


def test_hot_and_cold_use_ground_temperature():
    rows = [row(rider_id=1, ground=55, pos=1), row(rider_id=2, ground=55, pos=10),
            row(event_id="e2", rider_id=1, ground=12, pos=10), row(event_id="e2", rider_id=2, ground=12, pos=1)]
    assert condition_ranking(rows, "hot")[0]["rider_id"] == 1
    assert condition_ranking(rows, "cold")[0]["rider_id"] == 2


# --- bike relative ---------------------------------------------------------

def test_bike_relative_compares_riders_on_same_constructor():
    rows = []
    for i in range(4):
        ev = f"e{i}"
        rows += [
            row(event_id=ev, rider_id=20, constructor="Yamaha", pos=8),
            row(event_id=ev, rider_id=42, constructor="Yamaha", pos=16),
            row(event_id=ev, rider_id=93, constructor="Honda", pos=1),
        ]
    ranking = by_id(bike_relative_ranking(rows))
    assert ranking[20]["score"] > 0 > ranking[42]["score"]
    assert 93 not in ranking  # nobody else on the same bike


# --- race craft ------------------------------------------------------------

def test_positions_gained():
    rows = [row(rider_id=1, grid=10, pos=5), row(event_id="e2", rider_id=1, grid=4, pos=6)]
    assert by_id(positions_gained_ranking(rows))[1]["score"] == pytest.approx(1.5)


def test_dnf_rate():
    rows = [row(event_id=f"e{i}", rider_id=1, pos=None if i == 0 else 3) for i in range(4)]
    assert by_id(dnf_rate_ranking(rows))[1]["score"] == pytest.approx(0.25)


def test_sprint_vs_race_delta():
    rows = [row(session="SPR", rider_id=1, pos=1), row(session="RAC", rider_id=1, pos=11)]
    item = by_id(sprint_vs_race_ranking(rows))[1]
    assert item["sprint"] > item["race"]
    assert item["score"] > 0


def test_momentum_compares_last_races_to_season():
    rows = [row(event_id=f"e{i}", date=f"2025-0{i + 1}-01", rider_id=1, pos=15 if i < 5 else 1) for i in range(8)]
    assert by_id(momentum_ranking(rows, year=2025, last=3))[1]["score"] > 0


def test_home_effect():
    rows = [row(country="FR", rider_country="FR", rider_id=5, pos=1),
            row(event_id="e2", country="IT", rider_country="FR", rider_id=5, pos=10)]
    assert by_id(home_ranking(rows))[5]["score"] > 0


def test_head_to_head_counts_only_shared_sessions():
    rows = [
        row(event_id="e1", rider_id=1, pos=1), row(event_id="e1", rider_id=2, pos=2),
        row(event_id="e2", rider_id=1, pos=5, track="Wet"), row(event_id="e2", rider_id=2, pos=3, track="Wet"),
        row(event_id="e3", rider_id=1, pos=2),
    ]
    h2h = head_to_head(rows, 1, 2)
    assert h2h["total"] == {"a": 1, "b": 1, "n": 2}
    assert h2h["wet"] == {"a": 0, "b": 1, "n": 1}

from circuit_pdf import parse_circuit_text

TEXT = """CIRCUIT INFORMATION:   CHANG INTERNATIONAL CIRC
4554 m.
Records Rider TimeSeason Speed
All-Time Lap Record Marco BEZZECCHI (ITA) 1'28.526 185.1 Km/h2026
Best Race Lap
Best Pole
Marco BEZZECCHI (ITA) 1'30.487 181.1 Km/h
Marco BEZZECCHI (ITA) 1'28.652 184.9 Km/h2026
2026
Top Speed Marc MARQUEZ (SPA) 341.7 Km/h2026
All-Time Lap Record Manuel GONZALEZ (SPA) 1'34.501 173.4 Km/h2026
Best Race Lap
Best Pole
Manuel GONZALEZ (SPA) 1'35.379 171.8 Km/h
Senna AGIUS (AUS) 1'34.576 173.3 Km/h2026
2026
Top Speed Tony ARBOLINO (ITA) 284.9 Km/h2025
All-Time Lap Record David ALMANSA (SPA) 1'40.088 163.7 Km/h2026
Best Race Lap
Best Pole
David MU�OZ (SPA) 1'41.042 162.2 Km/h
David ALMANSA (SPA) 1'40.088 163.7 Km/h2026
2025
Top Speed Eddie O'SHEA (GBR) 242.1 Km/h2026
MotoGP
Moto2
Moto3
Motorcycle
Best Lap Marc MARQUEZ (SPA) 1'28.782 184.6 Km/h
Race fastest lap
Pole position
Marc MARQUEZ (SPA) 1'30.637 180.8 Km/h
Marc MARQUEZ (SPA) 1'28.782 184.6 Km/h
Top Speed Raul FERNANDEZ (SPA) 341.7 Km/h
Manuel GONZALEZ (SPA) 1'34.591 173.3 Km/h
Manuel GONZALEZ (SPA) 1'35.390 171.8 Km/h
Manuel GONZALEZ (SPA) 1'34.634 173.2 Km/h
Tony ARBOLINO (ITA) 284.9 Km/h
Jose Antonio RUEDA (SPA) 1'40.350 163.3 Km/h
David MU�OZ (SPA) 1'41.042 162.2 Km/h
Matteo BERTELLE (ITA) 1'40.400 163.2 Km/h
Stefano NEPA (ITA) 240.0 Km/h
1.
Manuel GONZALEZ (SPA)
"""


def test_parses_current_records_per_category():
    data = parse_circuit_text(TEXT)
    gp = data["records"]["MotoGP"]
    assert gp["all_time_lap"] == {"rider": "Marco BEZZECCHI", "nation": "ITA", "time": "1'28.526", "speed": 185.1, "year": 2026}
    assert gp["best_race_lap"]["time"] == "1'30.487"
    assert gp["best_pole"]["time"] == "1'28.652"
    assert gp["top_speed"] == {"rider": "Marc MARQUEZ", "nation": "SPA", "time": None, "speed": 341.7, "year": 2026}
    assert data["records"]["Moto2"]["top_speed"]["year"] == 2025
    assert data["records"]["Moto3"]["best_race_lap"]["rider"] == "David MUÑOZ"


def test_parses_previous_edition():
    prev = parse_circuit_text(TEXT)["previous"]
    assert prev["MotoGP"]["pole"]["time"] == "1'28.782"
    assert prev["MotoGP"]["top_speed"]["rider"] == "Raul FERNANDEZ"
    assert prev["Moto3"]["race_fastest_lap"]["time"] == "1'41.042"


def test_unexpected_layout_degrades_to_empty_sections():
    assert parse_circuit_text("nothing useful here") == {"records": {}, "previous": {}}
    broken = "Top Speed Marc MARQUEZ (SPA) 341.7 Km/h2026\n" * 12
    assert parse_circuit_text(broken)["records"] == {}

from weather import race_weekend_forecast, wet_weight

OPEN_METEO = {
    "daily": {
        "time": ["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"],
        "precipitation_probability_max": [10, 8, 32, 70, 5],
        "precipitation_sum": [0.0, 0.3, 6.9, 12.0, 0.0],
        "temperature_2m_max": [19.6, 17.2, 15.7, 18.2, 16.0],
        "temperature_2m_min": [10.0, 9.0, 8.5, 9.9, 7.0],
        "wind_speed_10m_max": [12.0, 20.0, 31.5, 18.0, 9.0],
        "weather_code": [1, 2, 61, 63, 0],
    }
}


def test_forecast_keeps_only_weekend_days():
    days = race_weekend_forecast(OPEN_METEO, "2026-11-20", "2026-11-22")
    assert [d["date"] for d in days] == ["2026-11-20", "2026-11-21", "2026-11-22"]
    assert days[-1] == {"date": "2026-11-22", "rain_prob": 70, "rain_mm": 12.0, "t_max": 18.2,
                        "t_min": 9.9, "wind": 18.0, "code": 63}


def test_forecast_handles_missing_payload():
    assert race_weekend_forecast({}, "2026-11-20", "2026-11-22") == []


def test_wet_weight_from_override_or_race_day():
    days = race_weekend_forecast(OPEN_METEO, "2026-11-20", "2026-11-22")
    assert wet_weight(days, "dry") == 0.0
    assert wet_weight(days, "wet") == 1.0
    assert wet_weight(days, "mixed") == 0.5
    assert wet_weight(days, None) == 0.7  # race day = last day of the weekend
    assert wet_weight([], None) == 0.0

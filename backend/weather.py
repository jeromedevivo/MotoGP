"""Race-weekend forecast from Open-Meteo (free, no API key, ~16 days ahead)."""
from typing import List, Optional

OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&timezone=auto&forecast_days=16"
    "&daily=precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min,"
    "wind_speed_10m_max,weather_code"
)
SCENARIOS = {"dry": 0.0, "mixed": 0.5, "wet": 1.0}
FIELDS = {
    "rain_prob": "precipitation_probability_max", "rain_mm": "precipitation_sum", "t_max": "temperature_2m_max",
    "t_min": "temperature_2m_min", "wind": "wind_speed_10m_max", "code": "weather_code",
}


def race_weekend_forecast(payload: dict, start: str, end: str) -> List[dict]:
    daily = (payload or {}).get("daily") or {}
    days = []
    for i, date in enumerate(daily.get("time") or []):
        if start <= date <= end:
            values = {key: (daily.get(src) or [None] * (i + 1))[i] for key, src in FIELDS.items()}
            days.append({"date": date, **values})
    return days


def wet_weight(days: List[dict], scenario: Optional[str]) -> float:
    """0 = dry race, 1 = wet race. A scenario overrides the forecast (race day = last day)."""
    if scenario in SCENARIOS:
        return SCENARIOS[scenario]
    if not days:
        return 0.0
    return round((days[-1].get("rain_prob") or 0) / 100, 2)

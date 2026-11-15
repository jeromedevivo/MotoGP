# MotoGP API Documentation

This document describes the REST API endpoints provided by the MotoGP backend service.

## Base URL

All endpoints are prefixed with `/api` and are proxied from the frontend to the backend service at `http://localhost:8000`.

## Endpoints

### Seasons

#### Get All Seasons
```
GET /api/seasons
```

**Response**: Array of Season objects
```json
[
  {
    "id": "uuid",
    "year": 2023,
    "current": true
  }
]
```

#### Get Current Season
```
GET /api/current-season
```

**Response**: Season object
```json
{
  "id": "uuid",
  "year": 2023,
  "current": true
}
```

### Categories

#### Get Categories for Season
```
GET /api/categories?season_id=uuid
```

**Response**: Array of Category objects
```json
[
  {
    "id": "uuid",
    "name": "MotoGP",
    "legacy_id": 1
  }
]
```

### Events

#### Get Events for Season
```
GET /api/events?season_id=uuid&is_finished=true|false
```

**Response**: Array of Event objects
```json
[
  {
    "id": "uuid",
    "name": "Spanish Grand Prix",
    "sponsored_name": "Gran Premio de España",
    "date_start": "2023-05-14T00:00:00Z",
    "date_end": "2023-05-14T00:00:00Z",
    "status": "Scheduled"
  }
]
```

#### Get Upcoming Events
```
GET /api/upcoming-events?season_id=uuid
```

**Response**: Array of Event objects

#### Get Past Events
```
GET /api/past-events?season_id=uuid
```

**Response**: Array of Event objects

### Sessions

#### Get Sessions for Event and Category
```
GET /api/sessions?event_id=uuid&category_id=uuid
```

**Response**: Array of Session objects
```json
[
  {
    "id": "uuid",
    "type": "RAC",
    "date": "2023-05-14T00:00:00Z",
    "number": 1,
    "status": "Scheduled"
  }
]
```

### Standings

#### Get Rider Standings
```
GET /api/standings?season_id=uuid&category_id=uuid
```

**Response**: Array of RiderStanding objects
```json
[
  {
    "id": "uuid",
    "position": 1,
    "rider": {
      "id": "uuid",
      "full_name": "Fabio Quartararo"
    },
    "points": 25
  }
]
```

#### Get Constructor Standings
```
GET /api/constructor-standings?season_id=uuid&category_id=uuid
```

**Response**: Array of ConstructorStanding objects
```json
[
  {
    "id": "uuid",
    "position": 1,
    "constructor_name": "Honda",
    "points": 125
  }
]
```

#### Get Team Standings
```
GET /api/team-standings?season_id=uuid&category_id=uuid
```

**Response**: Array of TeamStanding objects
```json
[
  {
    "id": "uuid",
    "position": 1,
    "team_name": "Honda Team",
    "constructor_name": "Honda",
    "points": 125
  }
]
```

### Session Results

#### Get Race Results for Session
```
GET /api/session-results?session_id=uuid
```

**Response**: Array of RaceResult objects
```json
[
  {
    "id": "uuid",
    "position": 1,
    "rider": {
      "id": "uuid",
      "full_name": "Fabio Quartararo"
    },
    "points": 25
  }
]
```

### Event Entries

#### Get Entry List for Event and Category
```
GET /api/event-entries?event_id=uuid&category_id=uuid
```

**Response**: Array of Rider objects

### Riders

#### Get All Riders
```
GET /api/riders
```

**Response**: Array of Rider objects

#### Get Rider Details
```
GET /api/riders/{rider_id}
```

**Response**: Rider object

### Standings Files

#### Get Standings Files
```
GET /api/standings-files?season_id=uuid&category_id=uuid
```

**Response**: Object with file references

### Event Details

#### Get Event Details
```
GET /api/events/{event_id}
```

**Response**: Event object

### Live Timing

#### Get Live Timing Data
```
GET /api/live-timing
```

**Response**: Live timing data object

### Predictions

#### Get Race Prediction
```
GET /api/predictions?event_id=uuid&category_id=uuid[&scenario=dry|mixed|wet]
```

Without `scenario`, the rain probability of race day (Open-Meteo forecast) decides the dry/wet blend.
See [PREDICTIONS.md](PREDICTIONS.md) for the model.

**Response**
```json
{
  "event": { "id": "uuid", "name": "GRAND PRIX OF PORTUGAL", "date_start": "2026-11-20", "date_end": "2026-11-22" },
  "category": "MotoGP",
  "weather": { "days": [{ "date": "2026-11-22", "rain_prob": 33, "rain_mm": 0, "t_max": 18.2, "t_min": 9.9, "wind": 12, "code": 2 }],
               "wet_weight": 0.33, "scenario": "forecast" },
  "weights": { "championship": 0.15, "form": 0.2, "bike": 0.15, "circuit": 0.15, "condition": 0.15, "talent": 0.05, "qualifying": 0.1, "reliability": 0.05 },
  "model": { "races": 80, "category": "MotoGP", "since": 2022 },
  "predictions": [
    { "rider_id": 7444, "rider": "Marc Marquez", "number": 93, "constructor": "Ducati", "points": 431,
      "factors": { "championship": 1.0, "form": 0.98, "...": 0.0 }, "home": false,
      "win": 0.522, "podium": 0.922, "top5": 0.994, "expected_position": 1.8, "rank": 1 }
  ]
}
```

### Insights (history since 2018)

These endpoints read the cached history dataset. They return `503` while the first build is running.

| Endpoint | Description |
|---|---|
| `GET /api/insights/status` | Dataset size, build date, refresh state, calibration info |
| `POST /api/insights/refresh` | Start an incremental refresh in the background |
| `GET /api/insights/rankings?category=MotoGP` | The 16 rider rankings for the current grid of a class |
| `GET /api/insights/rider/{legacy_id}` | One rider: rank in every ranking, circuit-by-circuit results, seasons |
| `GET /api/insights/h2h?a={legacy_id}&b={legacy_id}` | Head-to-head finishes (total, dry, wet, races, sprints) |
| `GET /api/circuit/{event_id}` | Circuit layout and geometry, records (API + official PDF), podium history, past conditions, specialists |
| `GET /api/weather?event_id=uuid` | Weekend forecast and conditions of past editions |

Riders are identified by their `legacy_id` (the id shared by the results API and the riders API).

### Calendar

#### Generate iCalendar File
```
GET /api/calendar-ics?event_id=uuid
```

**Response**: Object with iCal content and event name
```json
{
  "ical": "BEGIN:VCALENDAR...",
  "eventName": "Spanish Grand Prix"
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200 OK` - Successful request
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - API temporarily unavailable
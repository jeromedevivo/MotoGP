
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
        raise HTTPException(status_code=404, detail="No current season found")
    
    return current_season

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
        # Fetch from broadcast API which has all riders
        data = await http_client.get("https://api.motogp.pulselive.com/riders")
        data.raise_for_status()
        return data.json()
    except Exception as e:
        print(f"Error fetching riders: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch riders: {str(e)}")

@app.get("/api/riders/{rider_id}")
async def get_rider_detail(rider_id: str):
    """Get detailed information about a specific rider"""
    try:
        # Fetch from broadcast API
        data = await http_client.get(f"https://api.motogp.pulselive.com/riders/{rider_id}")
        data.raise_for_status()
        return data.json()
    except Exception as e:
        print(f"Error fetching rider details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch rider details: {str(e)}")

@app.get("/api/events/{event_id}")
async def get_event_detail(event_id: str):
    """Get detailed information about a specific event"""
    try:
        # Fetch from broadcast API
        data = await http_client.get(f"https://api.motogp.pulselive.com/events/{event_id}")
        data.raise_for_status()
        return data.json()
    except Exception as e:
        print(f"Error fetching event details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch event details: {str(e)}")

@app.get("/api/live-timing")
async def get_live_timing():
    """Get live timing data"""
    try:
        # Fetch from live timing API
        data = await http_client.get("https://api.motogp.pulselive.com/motogp/v1/timing-gateway/livetiming-lite")
        data.raise_for_status()
        return data.json()
    except Exception as e:
        print(f"Error fetching live timing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch live timing data: {str(e)}")

@app.get("/api/predictions")
async def get_predictions(event_id: str, category_id: str):
    """Generate predictions for an event (mock implementation with simple model)"""
    try:
        # Get rider entries for the event
        riders_data = await get_event_entries(event_id, category_id)
        
        if not riders_data:
            raise HTTPException(status_code=404, detail="No riders found for this event")
        
        # In a real-world scenario, we would use historical data and a trained model
        # For now, we'll create a simplified prediction based on rider numbers (as a placeholder)
        predictions = []
        
        for idx, rider in enumerate(riders_data):
            rider_info = rider.get("rider", {})
            
            # Calculate a pseudo-probability (in a real app, this would be ML-based)
            # This is just a placeholder implementation
            rider_id = rider_info.get("id", "")
            probability = min(0.95, max(0.1, (100 - (idx * 5)) / 100))
            
            # Assign a form trend (would be based on recent performances in reality)
            if idx < 3:
                form = "ascending"
            elif idx < 7:
                form = "stable"
            else:
                form = "descending"
                
            predictions.append({
                "rider_id": rider_id,
                "rider_name": rider_info.get("full_name", "Unknown Rider"),
                "rider_number": rider_info.get("number", 0),
                "probability": round(probability, 2),
                "form": form
            })
            
            if len(predictions) >= 5:
                break
                
        return predictions
    
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error generating predictions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

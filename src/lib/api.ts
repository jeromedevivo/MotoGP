
import { getPredictionBoard } from "@/lib/insights";
import { Season, Category, Event, Session, RiderStanding, RaceResult, Rider, Prediction, Team, Constructor } from "@/types";

interface ConstructorStanding {
  id: string;
  position: number;
  constructor_name: string;
  points: number;
}

interface TeamStanding {
  id: string;
  position: number;
  team_name: string;
  constructor_name: string;
  points: number;
}

const API_BASE = "/api"; // Proxy to our Python backend

// Helper function to handle fetch requests
async function fetchFromApi<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    
    // Validate that we got the expected data structure
    if (data === null || data === undefined) {
      throw new Error(`No data returned from endpoint: ${endpoint}`);
    }
    
    return data as T;
  } catch (error) {
    console.error("API request failed:", error);
    // Re-throw the error so it can be handled by the calling component
    throw error;
  }
}

// Get all seasons
export const getSeasons = async (): Promise<Season[]> => {
  return fetchFromApi<Season[]>("/seasons");
};

// Get current season
export const getCurrentSeason = async (): Promise<Season> => {
  // First get all seasons and find the current one
  const seasons = await getSeasons();
  const currentSeason = seasons.find(season => season.current);
  
  if (!currentSeason) {
    throw new Error("No current season found");
  }
  
  return currentSeason;
};

// Get categories for a season
export const getCategories = async (seasonId: string): Promise<Category[]> => {
  return fetchFromApi<Category[]>(`/categories?season_id=${encodeURIComponent(seasonId)}`);
};

// Get events for a season
export const getEvents = async (seasonId: string, isFinished?: boolean): Promise<Event[]> => {
  const finishedParam = isFinished !== undefined ? `&is_finished=${isFinished}` : "";
  return fetchFromApi<Event[]>(`/events?season_id=${encodeURIComponent(seasonId)}${finishedParam}`);
};

// Get upcoming events (not finished)
export const getUpcomingEvents = async (seasonId: string): Promise<Event[]> => {
  return fetchFromApi<Event[]>(`/upcoming-events?season_id=${encodeURIComponent(seasonId)}`);
};

// Get past events
export const getPastEvents = async (seasonId: string): Promise<Event[]> => {
  return fetchFromApi<Event[]>(`/past-events?season_id=${encodeURIComponent(seasonId)}`);
};

// Get sessions for an event and category
export const getSessions = async (eventId: string, categoryId: string): Promise<Session[]> => {
  return fetchFromApi<Session[]>(
    `/sessions?event_id=${encodeURIComponent(eventId)}&category_id=${encodeURIComponent(categoryId)}`,
  );
};

// Get rider standings for a season and category
export const getRiderStandings = async (seasonId: string, categoryId: string): Promise<RiderStanding[]> => {
  return fetchFromApi<RiderStanding[]>(
    `/standings?season_id=${encodeURIComponent(seasonId)}&category_id=${encodeURIComponent(categoryId)}`,
  );
};

// Get constructor standings for a season and category
export const getConstructorStandings = async (seasonId: string, categoryId: string): Promise<ConstructorStanding[]> => {
  return fetchFromApi<ConstructorStanding[]>(
    `/constructor-standings?season_id=${encodeURIComponent(seasonId)}&category_id=${encodeURIComponent(categoryId)}`,
  );
};

// Get team standings for a season and category
export const getTeamStandings = async (seasonId: string, categoryId: string): Promise<TeamStanding[]> => {
  return fetchFromApi<TeamStanding[]>(
    `/team-standings?season_id=${encodeURIComponent(seasonId)}&category_id=${encodeURIComponent(categoryId)}`,
  );
};

// Get race results for a session
export const getSessionResults = async (sessionId: string): Promise<RaceResult[]> => {
  return fetchFromApi<RaceResult[]>(`/session-results?session_id=${encodeURIComponent(sessionId)}`);
};

// Get entry list for an event and category
export const getEventEntries = async (eventId: string, categoryId: string): Promise<Rider[]> => {
  return fetchFromApi<Rider[]>(
    `/event-entries?event_id=${encodeURIComponent(eventId)}&category_id=${encodeURIComponent(categoryId)}`,
  );
};

// Get all riders
export const getAllRiders = async (): Promise<Rider[]> => {
  return fetchFromApi<Rider[]>("/riders");
};

// Get a rider by ID
export const getRiderDetails = async (riderId: string): Promise<Rider> => {
  return fetchFromApi<Rider>(`/riders/${encodeURIComponent(riderId)}`);
};

export const getStandingsFiles = async (seasonId: string, categoryId: string): Promise<Record<string, unknown>> => {
  return fetchFromApi<Record<string, unknown>>(
    `/standings-files?season_id=${encodeURIComponent(seasonId)}&category_id=${encodeURIComponent(categoryId)}`,
  );
};

// Get an event by ID
export const getEventDetails = async (eventId: string): Promise<Event> => {
  return fetchFromApi<Event>(`/events/${encodeURIComponent(eventId)}`);
};

// Get live timing information
export const getLiveTiming = async (): Promise<unknown> => {
  return fetchFromApi<unknown>("/live-timing");
};

// Get predictions for an event
export const getPredictions = async (eventId: string, categoryId: string): Promise<Prediction[]> => {
  const board = await getPredictionBoard(eventId, categoryId);
  return board.predictions.map((item) => ({
    rider: {
      id: item.rider_uuid || String(item.rider_id),
      full_name: item.rider,
      number: item.number ?? 0,
      constructor: { id: item.constructor || "unknown", name: item.constructor || "Moto inconnue", legacy_id: 0 },
    } as Rider,
    probability: item.win,
    form: item.factors.form >= 0.7 ? "ascending" : item.factors.form >= 0.45 ? "stable" : "descending",
    factors: {
      championship: item.factors.championship,
      recent_form: item.factors.form,
      bike: item.factors.bike,
      circuit: item.factors.circuit,
      historical_circuit_results: item.circuit_results.map((r) => r.pos).filter((p): p is number => p != null),
      historical_circuit_dates: item.circuit_results.filter((r) => r.pos != null).map((r) => String(r.year)),
      constructor_name: item.constructor,
    },
  }));
};

// Generate a calendar event
export const generateCalendarICS = async (
  eventId: string,
): Promise<{ ical: string; eventName: string }> => {
  return fetchFromApi<{ ical: string; eventName: string }>(
    `/calendar-ics?event_id=${encodeURIComponent(eventId)}`,
  );
};

// Download ICS file
export const downloadICSFile = (icalContent: string, eventName: string) => {
  const blob = new Blob([icalContent], { type: 'text/calendar' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${eventName.replace(/\s+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

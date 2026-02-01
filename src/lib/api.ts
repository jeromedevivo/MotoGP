
import { Season, Category, Event, Session, RiderStanding, RaceResult, Rider, Prediction, Team, Constructor } from "@/types";

const API_BASE = "http://localhost:8000/api"; // Proxy to our Python backend

// Helper function to handle fetch requests
async function fetchFromApi<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

// Get all seasons
export const getSeasons = async (): Promise<Season[]> => {
  return fetchFromApi<Season[]>("/seasons");
};

// Get current season
export const getCurrentSeason = async (): Promise<Season> => {
  return fetchFromApi<Season>("/current-season");
};

// Get categories for a season
export const getCategories = async (seasonId: string): Promise<Category[]> => {
  return fetchFromApi<Category[]>(`/categories?season_id=${seasonId}`);
};

// Get events for a season
export const getEvents = async (seasonId: string, isFinished?: boolean): Promise<Event[]> => {
  const finishedParam = isFinished !== undefined ? `&is_finished=${isFinished}` : "";
  return fetchFromApi<Event[]>(`/events?season_id=${seasonId}${finishedParam}`);
};

// Get upcoming events (not finished)
export const getUpcomingEvents = async (seasonId: string): Promise<Event[]> => {
  return fetchFromApi<Event[]>(`/upcoming-events?season_id=${seasonId}`);
};

// Get past events
export const getPastEvents = async (seasonId: string): Promise<Event[]> => {
  return fetchFromApi<Event[]>(`/past-events?season_id=${seasonId}`);
};

// Get sessions for an event and category
export const getSessions = async (eventId: string, categoryId: string): Promise<Session[]> => {
  return fetchFromApi<Session[]>(`/sessions?event_id=${eventId}&category_id=${categoryId}`);
};

// Get rider standings for a season and category
export const getRiderStandings = async (seasonId: string, categoryId: string): Promise<RiderStanding[]> => {
  return fetchFromApi<RiderStanding[]>(`/standings?season_id=${seasonId}&category_id=${categoryId}`);
};

// Get constructor standings for a season and category
export const getConstructorStandings = async (seasonId: string, categoryId: string): Promise<any[]> => {
  return fetchFromApi<any[]>(`/constructor-standings?season_id=${seasonId}&category_id=${categoryId}`);
};

// Get team standings for a season and category
export const getTeamStandings = async (seasonId: string, categoryId: string): Promise<any[]> => {
  return fetchFromApi<any[]>(`/team-standings?season_id=${seasonId}&category_id=${categoryId}`);
};

// Get race results for a session
export const getSessionResults = async (sessionId: string): Promise<RaceResult[]> => {
  return fetchFromApi<RaceResult[]>(`/session-results?session_id=${sessionId}`);
};

// Get entry list for an event and category
export const getEventEntries = async (eventId: string, categoryId: string): Promise<Rider[]> => {
  return fetchFromApi<Rider[]>(`/event-entries?event_id=${eventId}&category_id=${categoryId}`);
};

// Get all riders
export const getAllRiders = async (): Promise<Rider[]> => {
  return fetchFromApi<Rider[]>(`/riders`);
};

// Get single rider details
export const getRiderDetails = async (riderId: string): Promise<Rider> => {
  return fetchFromApi<Rider>(`/riders/${riderId}`);
};

// Get single event details
export const getEventDetails = async (eventId: string): Promise<Event> => {
  return fetchFromApi<Event>(`/events/${eventId}`);
};

// Get live timing data
export const getLiveTiming = async (): Promise<any> => {
  return fetchFromApi<any>(`/live-timing`);
};

// Get predictions for an event
export const getPredictions = async (eventId: string, categoryId: string): Promise<Prediction[]> => {
  const response = await fetchFromApi<any[]>(`/predictions?event_id=${eventId}&category_id=${categoryId}`);
  
  return response.map(item => ({
    rider: {
      id: item.rider_id,
      full_name: item.rider_name,
      number: item.rider_number,
      constructor: {
        id: "placeholder",
        name: "Placeholder",
        legacy_id: 0
      }
    } as Rider,
    probability: item.probability,
    form: item.form as "ascending" | "descending" | "stable"
  }));
};

// Generate calendar ICS file
export const generateCalendarICS = async (eventId: string): Promise<{ ical: string, eventName: string }> => {
  return fetchFromApi<{ ical: string, eventName: string }>(`/calendar-ics?event_id=${eventId}`);
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

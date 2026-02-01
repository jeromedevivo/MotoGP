
export interface Season {
  id: string;
  year: number;
  current: boolean;
}

export interface Category {
  id: string;
  name: string;
  legacy_id: number;
}

export interface Country {
  iso: string;
  name: string;
  region_iso?: string;
  flag?: string;
}

export interface Circuit {
  id: string;
  name: string;
  iso_code?: string;
  country: string;
  region?: string;
  city?: string;
  postal_code?: string;
  address?: string;
  lat?: string;
  lng?: string;
  place_id?: string;
  constructed?: number;
  designer?: string;
  active?: boolean;
}

export interface Event {
  id: string;
  name: string;
  sponsored_name?: string;
  country?: Country;
  circuit?: Circuit;
  date_start: string;
  date_end: string;
  status: string;
}

export interface Session {
  id: string;
  type: string;
  date: string;
  number: number;
  condition?: {
    track: string;
    air: string;
    humidity: string;
    ground: string;
    weather: string;
  };
  status: string;
  category: Category;
}

export interface Rider {
  id: string;
  full_name: string;
  name?: string;
  surname?: string;
  number?: number;
  country?: Country;
  team?: Team;
  constructor?: Constructor;
  position?: number;
  points?: number;
  // Custom property for predictions
  probability?: number;
  form?: "ascending" | "descending" | "stable";
}

export interface Team {
  id: string;
  name: string;
  constructor?: Constructor;
  color?: string;
  text_color?: string;
  picture?: string;
}

export interface Constructor {
  id: string;
  name: string;
  legacy_id: number;
}

export interface RiderStanding {
  id: string;
  position: number;
  rider: Rider;
  team: Team;
  constructor: Constructor;
  points: number;
}

export interface RaceResult {
  id: string;
  position: number;
  rider: Rider;
  team: Team;
  constructor: Constructor;
  best_lap?: {
    number: number;
    time: string;
  };
  total_laps?: number;
  top_speed?: number;
  gap?: {
    first: string;
    prev: string;
  };
  status: string;
}

export interface Prediction {
  rider: Rider;
  probability: number;
  form: "ascending" | "descending" | "stable";
}


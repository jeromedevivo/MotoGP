// Client + presentation helpers for the /api/insights, /api/circuit and /api/predictions endpoints.

export type Scenario = "dry" | "mixed" | "wet";

export interface RankingItem {
  rider_id: number;
  rider: string;
  rider_country?: string;
  constructor?: string;
  team?: string;
  category?: string;
  score: number;
  rank: number;
  n: number;
  delta?: number;
  raw?: number;
  avg?: number;
  poles?: number;
  dnf?: number;
  sprint?: number;
  race?: number;
  recent?: number;
  season?: number;
  home?: number;
  away?: number;
  results?: Array<number | null> | Array<{ year: number; session: string; pos: number | null; track?: string }>;
}

export interface RankingsBundle {
  category: string;
  year: number;
  built_at?: string;
  rankings: Record<string, RankingItem[]>;
}

export interface RiderRank extends Omit<RankingItem, "rider"> {
  of: number;
}

export interface RiderInsights {
  rider_id: number;
  rider: string;
  rider_country?: string;
  constructor?: string;
  team?: string;
  category?: string;
  year: number;
  ranks: Record<string, RiderRank>;
  highlights: Array<RiderRank & { key: string }>;
  circuits: Array<{
    circuit_id: string; name?: string; event?: string; best: number | null; avg: number | null;
    wins: number; podiums: number; starts: number;
    results: Array<{ year: number; session: string; category: string; pos: number | null; track?: string }>;
  }>;
  seasons: Array<{ year: number; category: string; starts: number; wins: number; podiums: number; dnf: number; avg: number | null }>;
}

export interface HeadToHead {
  [bucket: string]: { a: number; b: number; n: number };
}

export interface ForecastDay {
  date: string;
  rain_prob: number | null;
  rain_mm: number | null;
  t_max: number | null;
  t_min: number | null;
  wind: number | null;
  code: number | null;
}

export type FactorKey = "championship" | "form" | "bike" | "circuit" | "condition" | "talent" | "qualifying" | "reliability";

export interface RacePrediction {
  rider_id: number;
  rider: string;
  number?: number;
  rider_uuid?: string;
  rider_country?: string;
  constructor?: string;
  team?: string;
  points: number;
  position?: number;
  factors: Record<FactorKey, number>;
  home: boolean;
  recent_results: number[];
  circuit_results: Array<{ year: number; session: string; pos: number | null; track?: string }>;
  condition_samples: { wet: number; dry: number };
  score: number;
  win: number;
  podium: number;
  top5: number;
  expected_position: number;
  rank: number;
}

export interface PredictionBoard {
  event: { id: string; name: string; sponsored_name?: string; short_name?: string; date_start: string; date_end: string };
  category: string;
  weather: { days: ForecastDay[]; wet_weight: number; scenario: Scenario | "forecast" };
  weights: Record<FactorKey, number>;
  home_bonus: number;
  model: { races: number; samples: number; since: number } | null;
  predictions: RacePrediction[];
}

export interface RecordEntry {
  rider: string;
  nation?: string;
  time: string | null;
  speed: number | null;
  year: number | null;
}

export interface CircuitSheet {
  event: { id: string; name: string; sponsored_name?: string; short_name?: string; date_start: string; date_end: string; status: string };
  circuit: {
    id: string; name?: string; place?: string; city?: string; country?: string; lat?: number; lng?: number;
    length?: number; width?: number; straight?: number; left?: number; right?: number;
    constructed?: number; designer?: string; capacity?: number; svg?: string; png?: string;
  };
  api_records: Record<string, Array<{ type: string; rider: string; time: string; speed?: string; year?: number }>>;
  pdf: {
    url?: string;
    records?: Record<string, Record<"all_time_lap" | "best_race_lap" | "best_pole" | "top_speed", RecordEntry>>;
    previous?: Record<string, Record<"best_lap" | "race_fastest_lap" | "pole" | "top_speed", RecordEntry>>;
  };
  history: {
    editions: Array<{ year: number; category: string; event: string; track?: string;
      podium: Array<{ pos: number; rider: string; rider_id: number; constructor?: string; gap?: number | null }> }>;
    top_winners: Array<[string, number]>;
    top_constructors: Array<[string, number]>;
  };
  conditions: Array<{ year: number; session: string; track?: string; air?: number; ground?: number; humidity?: number; weather?: string }>;
  specialists: RankingItem[];
  files: Record<string, { url: string } | undefined>;
}

export interface InsightsStatus {
  ready: boolean;
  rows: number;
  built_at?: string;
  building: boolean;
  error?: string | null;
  model?: { races: number; samples: number } | null;
}

// --- presentation -------------------------------------------------------------

const CONSTRUCTOR_COLORS: Record<string, string> = {
  ducati: "#d7261e",
  aprilia: "#7d4cdb",
  ktm: "#f26a10",
  yamaha: "#2a5bd7",
  honda: "#11a39a",
  kalex: "#8d99a6",
  boscoscuro: "#c9a227",
  forward: "#3f9b4b",
  gasgas: "#c2185b",
  husqvarna: "#3949ab",
  cfmoto: "#00a3e0",
};
const NEUTRAL = "#7c8591";

export function constructorColor(name?: string | null): string {
  if (!name) return NEUTRAL;
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  return CONSTRUCTOR_COLORS[key] ?? NEUTRAL;
}

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function plateColors(team?: { color?: string; text_color?: string } | null, constructor?: string | null) {
  if (team?.color && team.text_color) return { bg: team.color, fg: team.text_color };
  const bg = constructorColor(constructor);
  return { bg, fg: luminance(bg) > 0.35 ? "#111111" : "#ffffff" };
}

const percent = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatPercent(value: number): string {
  if (value > 0 && value < 0.001) return "<0,1 %";
  return `${percent.format(value * 100)} %`;
}

export function gridRows<T>(items: T[], perRow = 3): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return rows;
}

export const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

export function scenarioFromWeight(weight: number): Scenario {
  if (weight < 0.35) return "dry";
  if (weight < 0.65) return "mixed";
  return "wet";
}

export const SCENARIO_LABEL: Record<Scenario, string> = { dry: "Sec", mixed: "Mixte", wet: "Mouillé" };

export interface RankingMeta {
  label: string;
  group: "Conditions" | "Moto & pilotage" | "Course" | "Circuits";
  description: string;
  higherIsBetter: boolean;
  format: "score" | "delta" | "positions" | "rate" | "stdev";
}

export const RANKINGS: Record<string, RankingMeta> = {
  wet: { label: "Piste mouillée", group: "Conditions", higherIsBetter: true, format: "score",
    description: "Résultats en course, sprint, qualif et essais sur piste mouillée (toutes catégories depuis 2018), lissés vers le niveau habituel du pilote quand l'échantillon est petit." },
  dry: { label: "Piste sèche", group: "Conditions", higherIsBetter: true, format: "score",
    description: "Même calcul sur piste sèche." },
  hot: { label: "Forte chaleur", group: "Conditions", higherIsBetter: true, format: "score",
    description: "Sessions avec une piste à 45 °C ou plus." },
  cold: { label: "Piste froide", group: "Conditions", higherIsBetter: true, format: "score",
    description: "Sessions avec une piste à 20 °C ou moins." },
  bike: { label: "Talent à moto égale", group: "Moto & pilotage", higherIsBetter: true, format: "delta",
    description: "Écart moyen avec les autres pilotes du même constructeur dans les mêmes sessions cette saison. Positif = il tire plus de la moto que les autres." },
  qualifying: { label: "Qualification", group: "Moto & pilotage", higherIsBetter: true, format: "score",
    description: "Position moyenne sur la grille sur les deux dernières saisons." },
  positions: { label: "Remontées", group: "Course", higherIsBetter: true, format: "positions",
    description: "Places gagnées en moyenne entre la grille et l'arrivée (sprints et courses)." },
  consistency: { label: "Régularité", group: "Course", higherIsBetter: false, format: "stdev",
    description: "Écart-type des positions à l'arrivée : plus c'est bas, plus le pilote finit toujours au même niveau." },
  reliability: { label: "Abandons", group: "Course", higherIsBetter: false, format: "rate",
    description: "Part des courses et sprints non terminés (chutes et casses)." },
  sprint: { label: "Sprint vs course", group: "Course", higherIsBetter: true, format: "delta",
    description: "Différence entre le niveau en sprint et en course longue. Positif = meilleur sur le format court." },
  momentum: { label: "Dynamique", group: "Course", higherIsBetter: true, format: "delta",
    description: "Les 5 dernières courses comparées à la moyenne de la saison. Positif = en progression." },
  home: { label: "Effet domicile", group: "Course", higherIsBetter: true, format: "delta",
    description: "Niveau au GP de son pays comparé au reste de la saison." },
  fast: { label: "Circuits rapides", group: "Circuits", higherIsBetter: true, format: "score",
    description: "Le tiers des circuits avec la plus longue ligne droite." },
  technical: { label: "Circuits sinueux", group: "Circuits", higherIsBetter: true, format: "score",
    description: "Le tiers des circuits avec la ligne droite la plus courte." },
  left: { label: "Circuits à gauche", group: "Circuits", higherIsBetter: true, format: "score",
    description: "Circuits avec plus de virages à gauche qu'à droite." },
  right: { label: "Circuits à droite", group: "Circuits", higherIsBetter: true, format: "score",
    description: "Circuits avec plus de virages à droite qu'à gauche." },
};

export const FACTORS: Record<FactorKey, { label: string; description: string }> = {
  championship: { label: "Championnat", description: "Points du pilote rapportés au leader." },
  form: { label: "Forme", description: "Moyenne des 5 dernières courses et sprints de la saison." },
  bike: { label: "Moto", description: "Niveau du constructeur cette saison." },
  circuit: { label: "Circuit", description: "Historique sur ce tracé, toutes catégories, lissé." },
  condition: { label: "Conditions", description: "Niveau sur le sec et le mouillé, mélangé selon le risque de pluie." },
  talent: { label: "Talent", description: "Écart avec les autres pilotes de la même moto." },
  qualifying: { label: "Qualif", description: "Positions sur la grille sur deux saisons." },
  reliability: { label: "Fiabilité", description: "1 − taux d'abandon." },
};

export function formatRankingValue(item: { score: number }, meta: RankingMeta): string {
  const v = item.score;
  switch (meta.format) {
    case "score": return Math.round(v * 100).toString();
    case "delta": return `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}`;
    case "positions": return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}`;
    case "rate": return formatPercent(v);
    case "stdev": return v.toFixed(1).replace(".", ",");
  }
}

export const shortName = (full?: string) => {
  if (!full) return "";
  const parts = full.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : full;
};

// --- API -------------------------------------------------------------------------

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const error = new Error(detail?.detail || `Erreur ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const q = encodeURIComponent;
export const getInsightsStatus = () => get<InsightsStatus>("/insights/status");
export const getRankings = (category = "MotoGP") => get<RankingsBundle>(`/insights/rankings?category=${q(category)}`);
export const getRiderInsights = (legacyId: number) => get<RiderInsights>(`/insights/rider/${legacyId}`);
export const getHeadToHead = (a: number, b: number) => get<HeadToHead>(`/insights/h2h?a=${a}&b=${b}`);
export const getCircuitSheet = (eventId: string) => get<CircuitSheet>(`/circuit/${q(eventId)}`);
export const getPredictionBoard = (eventId: string, categoryId: string, scenario?: Scenario) =>
  get<PredictionBoard>(`/predictions?event_id=${q(eventId)}&category_id=${q(categoryId)}${scenario ? `&scenario=${scenario}` : ""}`);

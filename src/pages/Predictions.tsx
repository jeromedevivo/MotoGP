import React, { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, ChevronDown, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Home,
  Snowflake, Sun, Wind,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NumberPlate from "@/components/NumberPlate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllRiders, getCategories, getCurrentSeason, getEvents } from "@/lib/api";
import {
  FACTORS, FactorKey, ForecastDay, PredictionBoard, RacePrediction, SCENARIO_LABEL, Scenario,
  constructorColor, formatPercent, getInsightsStatus, getPredictionBoard, gridRows, scenarioFromWeight, shortName,
} from "@/lib/insights";
import { cn } from "@/lib/utils";
import type { Rider } from "@/types";

type ScenarioChoice = Scenario | "forecast";
type SortKey = "rank" | "win" | "podium" | "top5" | "expected_position" | FactorKey;

const FACTOR_KEYS = Object.keys(FACTORS) as FactorKey[];

export function weatherIcon(code: number | null) {
  if (code == null) return Cloud;
  if (code === 0) return Sun;
  if (code <= 3) return CloudSun;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain;
  if (code <= 77 || code === 85 || code === 86) return Snowflake;
  return CloudLightning;
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });

export const ForecastDayCell: React.FC<{ day: ForecastDay; race: boolean }> = ({ day, race }) => {
  const Icon = weatherIcon(day.code);
  const rain = day.rain_prob ?? 0;
  return (
    <div className={cn("flex min-w-[6.25rem] flex-1 flex-col gap-1 rounded-md px-3 py-2", race ? "bg-secondary" : "")}>
      <span className="text-xs font-semibold capitalize text-muted-foreground">
        {dayLabel(day.date)}{race && " · course"}
      </span>
      <span className="flex items-center gap-2">
        <Icon size={20} className={rain >= 40 ? "text-wet" : "text-foreground"} aria-hidden />
        <span className="text-lg font-bold">{day.t_max != null ? `${Math.round(day.t_max)}°` : "—"}</span>
      </span>
      <span className={cn("text-xs font-semibold", rain >= 40 ? "text-wet" : "text-muted-foreground")}>
        Pluie {rain} %{day.rain_mm ? ` · ${String(day.rain_mm).replace(".", ",")} mm` : ""}
      </span>
      {day.wind != null && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wind size={12} aria-hidden /> {Math.round(day.wind)} km/h
        </span>
      )}
    </div>
  );
};

const ScenarioSwitch: React.FC<{ value: ScenarioChoice; onChange: (v: ScenarioChoice) => void; forecastWeight: number | null }> = ({
  value, onChange, forecastWeight,
}) => {
  const options: Array<{ id: ScenarioChoice; label: string }> = [
    { id: "forecast", label: forecastWeight != null ? `Prévision (${SCENARIO_LABEL[scenarioFromWeight(forecastWeight)]})` : "Prévision" },
    { id: "dry", label: "Sec" },
    { id: "mixed", label: "Mixte" },
    { id: "wet", label: "Mouillé" },
  ];
  return (
    <div role="radiogroup" aria-label="Scénario météo" className="inline-flex flex-wrap rounded-md border border-border bg-card p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
            value === option.id ? "bg-plate text-plate-ink" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

const GridSlot: React.FC<{ prediction: RacePrediction; rider?: Rider }> = ({ prediction, rider }) => (
  <Link
    to={rider ? `/riders/${rider.id}` : "#"}
    className="group flex items-center gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-foreground/40"
    style={{ viewTransitionName: `slot-${prediction.rider_id}` } as React.CSSProperties}
  >
    <span className="w-7 text-sm font-bold text-muted-foreground">P{prediction.rank}</span>
    <NumberPlate number={prediction.number} team={rider?.team} constructor={prediction.constructor} size="md" />
    <span className="min-w-0 flex-1">
      <span className="block truncate font-bold">{shortName(prediction.rider)}</span>
      <span className="block truncate text-xs text-muted-foreground">{prediction.constructor}</span>
    </span>
    <span className="text-right">
      <span className="block text-xl font-extrabold leading-none">{formatPercent(prediction.win)}</span>
      <span className="text-xs text-muted-foreground">podium {formatPercent(prediction.podium)}</span>
    </span>
  </Link>
);

/** Predicted order drawn as a MotoGP starting grid: rows of three, each slot stepped back. */
const PredictedGrid: React.FC<{ predictions: RacePrediction[]; riders: Map<string, Rider> }> = ({ predictions, riders }) => (
  <ol className="space-y-3" aria-label="Grille prédite, neuf premiers">
    {gridRows(predictions.slice(0, 9)).map((row, r) => (
      <li key={r} className="grid gap-3 sm:grid-cols-3 sm:pb-6">
        {row.map((p, i) => (
          <div key={p.rider_id} className={cn(i === 1 && "sm:translate-y-3", i === 2 && "sm:translate-y-6")}>
            <GridSlot prediction={p} rider={p.rider_uuid ? riders.get(p.rider_uuid) : undefined} />
          </div>
        ))}
      </li>
    ))}
  </ol>
);

const FactorBar: React.FC<{ value: number; color: string; label: string }> = ({ value, color, label }) => (
  <span className="flex items-center gap-1.5" title={`${label} : ${Math.round(value * 100)}`}>
    <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="block h-full rounded-full" style={{ width: `${Math.max(4, value * 100)}%`, backgroundColor: color }} />
    </span>
    <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{Math.round(value * 100)}</span>
  </span>
);

const RowDetails: React.FC<{ p: RacePrediction; weights: Record<FactorKey, number> }> = ({ p, weights }) => (
  <div className="grid gap-5 px-3 pb-4 pt-1 md:grid-cols-[1.6fr_1fr_0.9fr]">
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ce qui compte dans son score</p>
      <ul className="grid gap-x-6 gap-y-1.5 lg:grid-cols-2">
        {FACTOR_KEYS.map((key) => (
          <li key={key} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2 text-sm">
            <span title={FACTORS[key].description}>{FACTORS[key].label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${p.factors[key] * 100}%` }} />
            </span>
            <span className="text-right text-xs text-muted-foreground">× {Math.round(weights[key] * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sur ce circuit</p>
      {p.circuit_results.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {p.circuit_results.slice(-10).map((r, i) => (
            <li key={i} className={cn("rounded px-2 py-1 text-xs font-semibold", r.pos === 1 ? "bg-plate text-plate-ink" : "bg-secondary")}
              title={`${r.year} · ${r.session === "SPR" ? "sprint" : "course"}${r.track && r.track !== "Dry" ? " · mouillé" : ""}`}>
              {r.year % 100}{r.session === "SPR" ? "s" : ""} · {r.pos ? `P${r.pos}` : "Ab."}
              {r.track && r.track !== "Dry" && <CloudRain size={11} className="ml-1 inline text-wet" aria-label="mouillé" />}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">Jamais couru ici depuis 2018.</p>}
    </div>
    <div className="space-y-1 text-sm">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Repères</p>
      <p>Position moyenne simulée : <strong>{p.expected_position.toFixed(1).replace(".", ",")}</strong></p>
      <p>Sessions analysées : {p.condition_samples.dry} sur le sec, {p.condition_samples.wet} sur le mouillé</p>
      <p>Points au championnat : {p.points}</p>
      {p.home && <p className="flex items-center gap-1 font-semibold"><Home size={14} aria-hidden /> Course à domicile</p>}
    </div>
  </div>
);

const PredictionTable: React.FC<{ board: PredictionBoard; riders: Map<string, Rider> }> = ({ board, riders }) => {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "rank", desc: false });
  // leaders show their breakdown by default on wide screens; on phones the table stays compact
  const [open, setOpen] = useState<Set<number>>(() =>
    new Set(window.matchMedia("(min-width: 768px)").matches ? board.predictions.slice(0, 3).map((p) => p.rider_id) : []));

  const rows = useMemo(() => {
    const value = (p: RacePrediction) => (sort.key in FACTORS ? p.factors[sort.key as FactorKey] : (p[sort.key as keyof RacePrediction] as number));
    return [...board.predictions].sort((a, b) => (sort.desc ? value(b) - value(a) : value(a) - value(b)));
  }, [board.predictions, sort]);

  const header = (key: SortKey, label: string, className = "", defaultDesc = true) => {
    const active = sort.key === key;
    return (
      <th key={key} scope="col" className={cn("px-2 py-2 font-semibold", className)} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => setSort({ key, desc: active ? !sort.desc : defaultDesc })}>
          {label}
          {active && (sort.desc ? <ArrowDown size={12} aria-hidden /> : <ArrowUp size={12} aria-hidden />)}
        </button>
      </th>
    );
  };

  const toggle = (id: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full min-w-[46rem] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            {header("rank", "#", "w-10 pl-3", false)}
            <th scope="col" className="px-2 py-2 font-semibold">Pilote</th>
            {header("win", "Victoire", "text-right")}
            {header("podium", "Podium", "text-right")}
            {header("top5", "Top 5", "text-right")}
            {header("expected_position", "Pos. moy.", "text-right", false)}
            {FACTOR_KEYS.map((key) => header(key, FACTORS[key].label, "hidden xl:table-cell"))}
            <th scope="col" className="w-10"><span className="sr-only">Détails</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const rider = p.rider_uuid ? riders.get(p.rider_uuid) : undefined;
            const expanded = open.has(p.rider_id);
            const color = constructorColor(p.constructor);
            return (
              <React.Fragment key={p.rider_id}>
                <tr className={cn("border-t border-border first:border-t-0", expanded && "bg-muted/40")}>
                  <td className="py-2 pl-3 font-bold text-muted-foreground">{p.rank}</td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-2.5">
                      <NumberPlate number={p.number} team={rider?.team} constructor={p.constructor} size="xs" />
                      <span className="min-w-0">
                        {rider ? <Link to={`/riders/${rider.id}`} className="font-semibold hover:underline">{p.rider}</Link>
                          : <span className="font-semibold">{p.rider}</span>}
                        <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">{p.team}</span>
                        <span className="block text-xs font-bold sm:hidden">victoire {formatPercent(p.win)}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-bold">{formatPercent(p.win)}</td>
                  <td className="px-2 py-2 text-right">{formatPercent(p.podium)}</td>
                  <td className="px-2 py-2 text-right">{formatPercent(p.top5)}</td>
                  <td className="px-2 py-2 text-right">{p.expected_position.toFixed(1).replace(".", ",")}</td>
                  {FACTOR_KEYS.map((key) => (
                    <td key={key} className="hidden px-2 py-2 xl:table-cell">
                      <FactorBar value={p.factors[key]} color={color} label={FACTORS[key].label} />
                    </td>
                  ))}
                  <td className="pr-2 text-right">
                    <button type="button" onClick={() => toggle(p.rider_id)} aria-expanded={expanded}
                      className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"
                      aria-label={`${expanded ? "Masquer" : "Afficher"} le détail de ${p.rider}`}>
                      <ChevronDown size={16} className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="bg-muted/40">
                    <td colSpan={7 + FACTOR_KEYS.length}><RowDetails p={p} weights={board.weights} /></td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Method: React.FC<{ board: PredictionBoard }> = ({ board }) => (
  <section className="mt-10 grid gap-8 md:grid-cols-[1fr_1.2fr]" aria-labelledby="method-title">
    <div>
      <h2 id="method-title" className="font-display text-xl">Comment c'est calculé</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Chaque pilote reçoit un score à partir de huit facteurs mesurés sur tous les résultats depuis 2018, Moto2 et Moto3
        compris. Le facteur « Conditions » mélange son niveau sur le sec et sur le mouillé selon le risque de pluie du dimanche.
        {board.model
          ? ` L'écart entre les favoris et les autres est calibré sur ${board.model.races} courses passées, chacune prédite avec seulement les données disponibles avant elle.`
          : " Le calibrage historique est en cours de calcul ; les écarts sont fixés par défaut."}
        {" "}Les probabilités de podium et de top 5 viennent de 3 000 courses simulées.
      </p>
    </div>
    <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
      {FACTOR_KEYS.map((key) => (
        <li key={key}>
          <span className="block font-semibold">{FACTORS[key].label} · {Math.round(board.weights[key] * 100)} %</span>
          <span className="text-xs text-muted-foreground">{FACTORS[key].description}</span>
        </li>
      ))}
    </ul>
  </section>
);

export const NotReady: React.FC<{ error: unknown }> = ({ error }) => {
  const status = useQuery({ queryKey: ["insights-status"], queryFn: getInsightsStatus, refetchInterval: 15000 });
  const building = (error as { status?: number })?.status === 503;
  return (
    <div className="rounded-md border border-border bg-card p-8">
      <p className="font-display text-lg">{building ? "L'historique est en cours de construction" : "Données indisponibles"}</p>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        {building
          ? "Au premier lancement, le serveur télécharge tous les résultats depuis 2018 en respectant les limites de l'API officielle (une dizaine de minutes). La page se mettra à jour toute seule."
          : `Le serveur n'a pas pu répondre : ${(error as Error)?.message ?? "erreur inconnue"}.`}
      </p>
      {status.data && <p className="mt-3 text-xs text-muted-foreground">{status.data.rows.toLocaleString("fr-FR")} résultats chargés{status.data.building ? " · mise à jour en cours" : ""}</p>}
    </div>
  );
};

const PredictionsPage: React.FC = () => {
  const [categoryId, setCategoryId] = useState("");
  const [eventId, setEventId] = useState("");
  const [scenario, setScenario] = useState<ScenarioChoice>("forecast");

  const season = useQuery({ queryKey: ["current-season"], queryFn: getCurrentSeason });
  const categories = useQuery({ queryKey: ["categories", season.data?.id], queryFn: () => getCategories(season.data!.id), enabled: !!season.data });
  const events = useQuery({ queryKey: ["events", season.data?.id, "all"], queryFn: () => getEvents(season.data!.id), enabled: !!season.data });
  const riders = useQuery({ queryKey: ["riders"], queryFn: getAllRiders, staleTime: 3600_000 });
  const board = useQuery({
    queryKey: ["prediction-board", eventId, categoryId, scenario],
    queryFn: () => getPredictionBoard(eventId, categoryId, scenario === "forecast" ? undefined : scenario),
    enabled: !!eventId && !!categoryId,
    retry: (count, error) => (error as { status?: number }).status === 503 && count < 40,
    retryDelay: 15000,
  });

  const raceEvents = useMemo(() => (events.data ?? [])
    .filter((e) => !(e as { test?: boolean }).test)
    .sort((a, b) => a.date_start.localeCompare(b.date_start)), [events.data]);
  useEffect(() => {
    if (!categoryId && categories.data?.length) setCategoryId(categories.data.find((c) => c.name.startsWith("MotoGP"))?.id ?? categories.data[0].id);
  }, [categories.data, categoryId]);
  useEffect(() => {
    // next unfinished GP; once the season is over, the last one
    if (!eventId && raceEvents.length) setEventId((raceEvents.find((e) => e.status !== "FINISHED") ?? raceEvents[raceEvents.length - 1]).id);
  }, [raceEvents, eventId]);

  // Signature move: when the scenario changes, the grid slots glide to their new places (View Transitions).
  const [shown, setShown] = useState<PredictionBoard | undefined>();
  useEffect(() => {
    if (!board.data) return;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (shown && doc.startViewTransition) doc.startViewTransition(() => flushSync(() => setShown(board.data)));
    else setShown(board.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.data]);

  const ridersByUuid = useMemo(() => new Map((riders.data ?? []).map((r) => [r.id, r])), [riders.data]);
  const forecastWeight = shown?.weather.scenario === "forecast" ? shown.weather.wet_weight : null;
  const event = raceEvents.find((e) => e.id === eventId);
  const days = shown?.weather.days ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container overflow-x-clip py-8">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl">{event?.sponsored_name ?? event?.name ?? "Prédictions"}</h1>
            <p className="mt-1 text-muted-foreground">
              {event?.circuit?.name}
              {event && ` · ${new Date(event.date_start).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${new Date(event.date_end).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Select value={eventId} onValueChange={(v) => setEventId(v)}>
                <SelectTrigger className="w-full sm:w-64" aria-label="Grand Prix"><SelectValue placeholder="Grand Prix" /></SelectTrigger>
                <SelectContent>{raceEvents.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}{e.status === "FINISHED" ? " (terminé)" : ""}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-36" aria-label="Catégorie"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>{categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:items-end">
            {days.length > 0 ? (
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-border bg-card p-1" aria-label="Météo du week-end">
                {days.map((day, i) => <ForecastDayCell key={day.date} day={day} race={i === days.length - 1} />)}
              </div>
            ) : shown && (
              <p className="max-w-xs text-sm text-muted-foreground lg:text-right">
                Prévisions disponibles environ 15 jours avant la course. En attendant, choisissez un scénario.
              </p>
            )}
            <ScenarioSwitch value={scenario} onChange={setScenario} forecastWeight={forecastWeight} />
          </div>
        </section>

        <section className="mt-8" aria-labelledby="grid-title" aria-busy={board.isFetching}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="grid-title" className="font-display text-xl">Grille d'arrivée prédite</h2>
            {shown && (
              <p className="text-sm text-muted-foreground">
                Scénario : <strong className="text-foreground">{shown.weather.scenario === "forecast"
                  ? `${SCENARIO_LABEL[scenarioFromWeight(shown.weather.wet_weight)]} (${Math.round(shown.weather.wet_weight * 100)} % de pluie le jour de la course)`
                  : SCENARIO_LABEL[shown.weather.scenario]}</strong>
              </p>
            )}
          </div>
          {board.error && !shown ? <NotReady error={board.error} /> : !shown ? (
            <div className="grid gap-3 sm:grid-cols-3" aria-label="Chargement">
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-[4.25rem] animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : (
            <div className={cn("transition-opacity", board.isFetching && "opacity-60")}>
              <PredictedGrid predictions={shown.predictions} riders={ridersByUuid} />
            </div>
          )}
        </section>

        {shown && (
          <>
            <section className="mt-12" aria-labelledby="table-title">
              <h2 id="table-title" className="mb-4 font-display text-xl">Tous les pilotes</h2>
              <PredictionTable key={`${shown.event.id}-${shown.category}`} board={shown} riders={ridersByUuid} />
            </section>
            <Method board={shown} />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PredictionsPage;

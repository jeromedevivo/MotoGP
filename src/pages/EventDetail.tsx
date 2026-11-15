import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, CloudRain, ExternalLink, FileText, MapPin } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NumberPlate from "@/components/NumberPlate";
import { useToast } from "@/hooks/use-toast";
import {
  downloadICSFile, generateCalendarICS, getCategories, getCurrentSeason, getEventDetails, getSessionResults, getSessions,
} from "@/lib/api";
import { CircuitSheet, RecordEntry, formatPercent, getCircuitSheet, getPredictionBoard, shortName } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { ForecastDayCell, NotReady } from "@/pages/Predictions";
import { useRiderIndex } from "@/pages/Riders";

const CATS = ["MotoGP", "Moto2", "Moto3"] as const;
const SESSION_LABEL: Record<string, string> = {
  FP: "Essais libres", PR: "Essais qualificatifs", Q: "Qualifications", SPR: "Sprint", WUP: "Warm-up", RAC: "Course",
};
const CURRENT_RECORDS: Array<[keyof NonNullable<CircuitSheet["pdf"]["records"]>[string], string]> = [
  ["all_time_lap", "Record absolu du tour"], ["best_race_lap", "Meilleur tour en course"], ["best_pole", "Meilleure pole"], ["top_speed", "Vitesse de pointe"],
];
const PREVIOUS_RECORDS: Array<[keyof NonNullable<CircuitSheet["pdf"]["previous"]>[string], string]> = [
  ["best_lap", "Meilleur tour du week-end"], ["race_fastest_lap", "Meilleur tour en course"], ["pole", "Pole position"], ["top_speed", "Vitesse de pointe"],
];
const API_RECORD_LABEL: Record<string, string> = { recordLap: "Record absolu du tour", bestLap: "Meilleur tour en course", poleLap: "Meilleure pole", fastestLap: "Meilleur tour (dernière course)" };

interface SessionLite { id: string; type: string; number?: number | null; date: string; status?: string; condition?: { track?: string; air?: string; ground?: string; weather?: string } }
interface ResultLite {
  position?: number | null; status?: string; rider?: { full_name?: string; legacy_id?: number; number?: number };
  team?: { name?: string }; constructor?: { name?: string }; time?: string; gap?: { first?: string };
  best_lap?: { time?: string } | null; top_speed?: number | null; total_laps?: number;
}

const SKY: Record<string, string> = {
  Clear: "Dégagé", Sunny: "Ensoleillé", "Partly-Cloudy": "Partiellement nuageux", Cloudy: "Nuageux", Overcast: "Couvert",
  "Light-Rain": "Pluie faible", Raining: "Pluie", "Heavy-Rain": "Forte pluie", Rain: "Pluie", Fog: "Brouillard",
};
const paris = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", ...opts });
const speed = (s: number | null | string | undefined) => (s == null ? "" : `${String(s).replace(".", ",")} km/h`);

const Section: React.FC<{ id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({ id, title, aside, children }) => (
  <section className="mt-12" aria-labelledby={id}>
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="font-display text-xl">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

const RecordCell: React.FC<{ r?: RecordEntry }> = ({ r }) => r ? (
  <span className="block">
    <span className="block font-semibold">{r.time ?? speed(r.speed)}</span>
    <span className="block text-xs text-muted-foreground">
      {r.rider}{r.nation ? ` (${r.nation})` : ""}{r.time && r.speed ? ` · ${speed(r.speed)}` : ""}{r.year ? ` · ${r.year}` : ""}
    </span>
  </span>
) : <span className="text-muted-foreground">—</span>;

const RecordsTable: React.FC<{ rows: Array<[string, string]>; data?: Record<string, Record<string, RecordEntry>> }> = ({ rows, data }) => (
  <div className="overflow-x-auto rounded-md border border-border bg-card">
    <table className="w-full min-w-[40rem] text-sm">
      <thead className="border-b border-border text-left text-xs text-muted-foreground">
        <tr><th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Record</span></th>
          {CATS.map((c) => <th key={c} scope="col" className="px-3 py-2 font-semibold">{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map(([key, label]) => (
          <tr key={key} className="border-t border-border align-top">
            <th scope="row" className="px-3 py-2.5 text-left font-semibold">{label}</th>
            {CATS.map((c) => <td key={c} className="px-3 py-2.5"><RecordCell r={data?.[c]?.[key]} /></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [palmaresCat, setPalmaresCat] = useState<string>("MotoGP");
  const [sessionId, setSessionId] = useState<string>("");

  const event = useQuery({ queryKey: ["event", id], queryFn: () => getEventDetails(id!), enabled: !!id });
  const sheet = useQuery({
    queryKey: ["circuit-sheet", id], queryFn: () => getCircuitSheet(id!), enabled: !!id,
    retry: (count, error) => (error as { status?: number }).status === 503 && count < 40, retryDelay: 15000,
  });
  const season = useQuery({ queryKey: ["current-season"], queryFn: getCurrentSeason });
  const categories = useQuery({ queryKey: ["categories", season.data?.id], queryFn: () => getCategories(season.data!.id), enabled: !!season.data });
  const motogpId = categories.data?.find((c) => c.name.startsWith("MotoGP"))?.id;
  const sessions = useQuery({ queryKey: ["sessions", id, motogpId], queryFn: () => getSessions(id!, motogpId!), enabled: !!id && !!motogpId });
  const finished = sheet.data?.event.status === "FINISHED";
  const board = useQuery({
    queryKey: ["prediction-board", id, motogpId, "forecast"], queryFn: () => getPredictionBoard(id!, motogpId!),
    enabled: !!id && !!motogpId && sheet.data != null && !finished,
  });
  const sessionList = (sessions.data ?? []) as unknown as SessionLite[];
  useEffect(() => {
    const done = sessionList.filter((s) => s.status === "FINISHED" || s.status === "Official");
    if (!sessionId && done.length) setSessionId((done.find((s) => s.type === "RAC") ?? done[done.length - 1]).id);
  }, [sessionList, sessionId]);
  const results = useQuery({ queryKey: ["session-results", sessionId], queryFn: () => getSessionResults(sessionId), enabled: !!sessionId });
  const { byLegacy } = useRiderIndex();

  const editions = useMemo(() => (sheet.data?.history.editions ?? []).filter((e) => e.category === palmaresCat), [sheet.data, palmaresCat]);

  const addToCalendar = async () => {
    try {
      const ics = await generateCalendarICS(id!);
      downloadICSFile(ics.ical, ics.eventName);
      toast({ title: "Fichier calendrier créé", description: "Ouvrez-le pour ajouter le Grand Prix à votre agenda." });
    } catch {
      toast({ title: "Export impossible", description: "Le fichier calendrier n'a pas pu être créé, réessayez.", variant: "destructive" });
    }
  };

  if (event.isLoading) return <div className="min-h-screen bg-background"><Header /><main className="container py-8"><div className="h-72 animate-pulse rounded-md bg-muted" /></main></div>;
  if (event.error || !event.data) {
    return (
      <div className="min-h-screen bg-background"><Header />
        <main className="container py-20 text-center">
          <h1 className="font-display text-2xl">Grand Prix introuvable</h1>
          <Link to="/calendar" className="mt-4 inline-block font-semibold underline">Retour au calendrier</Link>
        </main><Footer />
      </div>
    );
  }

  const ev = event.data;
  const s = sheet.data;
  const c = s?.circuit;
  const pdfUrl = s?.pdf.url;
  const days = board.data?.weather.days ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl md:text-4xl">{ev.sponsored_name || ev.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-muted-foreground">
              <MapPin size={15} aria-hidden /> {ev.circuit?.name}{c?.city ? `, ${c.city}` : ""}
              <span aria-hidden>·</span>
              {paris(ev.date_start, { day: "numeric", month: "long" })} – {paris(ev.date_end, { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addToCalendar} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted">
              <CalendarPlus size={16} aria-hidden /> Ajouter au calendrier
            </button>
            {!finished && <Link to="/predictions" className="inline-flex items-center rounded-md bg-plate px-3 py-2 text-sm font-semibold text-plate-ink">Voir les prédictions</Link>}
          </div>
        </div>

        {sheet.error ? <div className="mt-8"><NotReady error={sheet.error} /></div> : (
          <>
            <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]" aria-label="Circuit">
              <figure className="rounded-md border border-border bg-[#f4f1ea] p-4">
                {c?.svg || c?.png
                  ? <img src={c.svg || c.png} alt={`Tracé de ${c.name ?? "ce circuit"}`} className="mx-auto max-h-[26rem] w-full object-contain" />
                  : <div className="h-72 animate-pulse rounded bg-black/5" />}
                <figcaption className="mt-2 text-center text-xs text-neutral-700">Tracé officiel · secteurs intermédiaires I1–I3, ligne d'arrivée et position de pole</figcaption>
              </figure>
              <div className="flex flex-col gap-6">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-border bg-card p-5 text-sm">
                  {[
                    ["Longueur", c?.length ? `${(c.length / 1000).toFixed(3).replace(".", ",")} km` : null],
                    ["Plus longue ligne droite", c?.straight ? `${c.straight} m` : null],
                    ["Virages", c?.left != null && c?.right != null ? `${c.left + c.right} · ${c.left} à gauche, ${c.right} à droite` : null],
                    ["Largeur", c?.width ? `${c.width} m` : null],
                    ["Construit en", c?.constructed],
                    ["Architecte", c?.designer],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-semibold">{value ?? (s ? "—" : <span className="inline-block h-4 w-20 animate-pulse rounded bg-muted" />)}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="mb-2 text-sm font-semibold">Météo du week-end</p>
                  {days.length ? (
                    <div className="flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1">
                      {days.map((d, i) => <ForecastDayCell key={d.date} day={d} race={i === days.length - 1} />)}
                    </div>
                  ) : (
                    <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                      {finished ? "Course terminée : voir les conditions relevées ci-dessous." : "Prévisions disponibles environ 15 jours avant la course."}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <Section id="records" title="Records du circuit"
              aside={pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><FileText size={14} aria-hidden /> Fiche officielle (PDF)</a>}>
              {s?.pdf.records && Object.keys(s.pdf.records).length
                ? <RecordsTable rows={CURRENT_RECORDS} data={s.pdf.records as Record<string, Record<string, RecordEntry>>} />
                : s && (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {(s.api_records.MotoGP ?? []).map((r) => (
                      <li key={r.type} className="rounded-md border border-border bg-card p-4 text-sm">
                        <p className="text-muted-foreground">{API_RECORD_LABEL[r.type] ?? r.type} · MotoGP</p>
                        <p className="font-semibold">{r.time} · {r.rider}{r.year ? ` (${r.year})` : ""}</p>
                      </li>
                    ))}
                  </ul>
                )}
            </Section>

            {s?.pdf.previous && Object.keys(s.pdf.previous).length > 0 && (
              <Section id="previous" title="L'édition précédente">
                <RecordsTable rows={PREVIOUS_RECORDS} data={s.pdf.previous as Record<string, Record<string, RecordEntry>>} />
              </Section>
            )}

            {!finished && board.data && (
              <Section id="favourites" title="Les favoris" aside={<Link to="/predictions" className="text-sm font-semibold underline">Prédiction complète</Link>}>
                <ol className="grid gap-2 sm:grid-cols-5">
                  {board.data.predictions.slice(0, 5).map((p) => {
                    return (
                      <li key={p.rider_id} className="flex items-center gap-2 rounded-md border border-border bg-card p-3">
                        <NumberPlate number={p.number} team={byLegacy.get(p.rider_id)?.team} constructor={p.constructor} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{shortName(p.rider)}</span>
                          <span className="text-sm font-bold">{formatPercent(p.win)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </Section>
            )}

            {s && s.specialists.length > 0 && (
              <Section id="specialists" title="Les spécialistes de ce tracé">
                <p className="-mt-2 mb-4 max-w-prose text-sm text-muted-foreground">Pilotes de la grille MotoGP actuelle classés sur leurs résultats ici depuis 2018, toutes catégories, comparés à leur niveau habituel.</p>
                <div className="overflow-x-auto rounded-md border border-border bg-card">
                  <table className="w-full min-w-[36rem] text-sm">
                    <tbody>
                      {s.specialists.map((sp) => {
                        const rider = byLegacy.get(sp.rider_id);
                        const res = (sp.results ?? []) as Array<{ year: number; session: string; pos: number | null; track?: string }>;
                        return (
                          <tr key={sp.rider_id} className="border-t border-border first:border-t-0">
                            <td className="w-10 py-2 pl-3 font-plate text-muted-foreground">{sp.rank}</td>
                            <td className="px-2 py-2">
                              <span className="flex items-center gap-2">
                                <NumberPlate number={rider?.number} team={rider?.team} constructor={sp.constructor} size="xs" />
                                {rider ? <Link to={`/riders/${rider.id}`} className="font-semibold hover:underline">{sp.rider}</Link> : <span className="font-semibold">{sp.rider}</span>}
                              </span>
                            </td>
                            <td className={cn("px-2 py-2 text-right text-xs font-semibold", (sp.delta ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                              {(sp.delta ?? 0) >= 0 ? "+" : "−"}{Math.abs(Math.round((sp.delta ?? 0) * 100))} vs habitude
                            </td>
                            <td className="px-3 py-2">
                              <span className="flex flex-wrap justify-end gap-1">
                                {res.slice(-6).map((x, i) => (
                                  <span key={i} className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", x.pos === 1 ? "bg-plate text-plate-ink" : "bg-secondary")}>
                                    {x.year % 100}{x.session === "SPR" ? "s" : ""} {x.pos ? `P${x.pos}` : "Ab."}
                                  </span>
                                ))}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {s && (
              <Section id="palmares" title="Palmarès depuis 2018"
                aside={
                  <div role="radiogroup" aria-label="Catégorie du palmarès" className="inline-flex rounded-md border border-border bg-card p-1">
                    {CATS.map((cat) => (
                      <button key={cat} type="button" role="radio" aria-checked={palmaresCat === cat} onClick={() => setPalmaresCat(cat)}
                        className={cn("rounded px-3 py-1 text-sm font-semibold", palmaresCat === cat ? "bg-plate text-plate-ink" : "text-muted-foreground hover:text-foreground")}>{cat}</button>
                    ))}
                  </div>
                }>
                <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
                  <div className="overflow-x-auto rounded-md border border-border bg-card">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead className="border-b border-border text-left text-xs text-muted-foreground">
                        <tr><th scope="col" className="px-3 py-2 font-semibold">Année</th>
                          {["Vainqueur", "2e", "3e"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {editions.map((e) => (
                          <tr key={e.year} className="border-t border-border">
                            <td className="whitespace-nowrap px-3 py-2 font-semibold">
                              {e.year}{e.track && e.track !== "Dry" && <CloudRain size={13} className="ml-1 inline text-wet" aria-label="course sous la pluie" />}
                            </td>
                            {[1, 2, 3].map((pos) => {
                              const p = e.podium.find((x) => x.pos === pos);
                              const rider = p ? byLegacy.get(p.rider_id) : undefined;
                              return (
                                <td key={pos} className="px-3 py-2">
                                  {p ? (
                                    <span className="flex items-center gap-2">
                                      <NumberPlate number={rider?.number} team={rider?.team} constructor={p.constructor} size="xs" />
                                      <span><span className="block font-semibold">{shortName(p.rider)}</span>
                                        <span className="block text-xs text-muted-foreground">{p.constructor}{pos > 1 && p.gap ? ` · +${String(p.gap).replace(".", ",")} s` : ""}</span></span>
                                    </span>
                                  ) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {!editions.length && <tr><td colSpan={4} className="p-4 text-muted-foreground">Pas de course {palmaresCat} sur ce circuit depuis 2018.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-5 text-sm">
                    <div>
                      <p className="mb-2 font-semibold">Plus de victoires en MotoGP</p>
                      <ol className="space-y-1">{s.history.top_winners.map(([name, n]) => <li key={name} className="flex justify-between"><span>{name}</span><span className="font-bold tabular-nums">{n}</span></li>)}</ol>
                    </div>
                    <div>
                      <p className="mb-2 font-semibold">Constructeurs vainqueurs</p>
                      <ol className="space-y-1">{s.history.top_constructors.map(([name, n]) => <li key={name} className="flex justify-between"><span>{name}</span><span className="font-bold tabular-nums">{n}</span></li>)}</ol>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {s && s.conditions.length > 0 && (
              <Section id="conditions" title="Conditions des éditions passées">
                <div className="overflow-x-auto rounded-md border border-border bg-card">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead className="border-b border-border text-left text-xs text-muted-foreground">
                      <tr>{["Année", "Course", "Piste", "Ciel", "Air", "Sol", "Humidité"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {s.conditions.map((k) => (
                        <tr key={`${k.year}-${k.session}`} className="border-t border-border">
                          <td className="px-3 py-2 font-semibold">{k.year}</td>
                          <td className="px-3 py-2">{k.session === "SPR" ? "Sprint" : "Course"}</td>
                          <td className={cn("px-3 py-2 font-semibold", k.track && k.track !== "Dry" && "text-wet")}>{k.track === "Dry" ? "Sèche" : k.track === "Wet" ? "Mouillée" : k.track ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{SKY[k.weather ?? ""] ?? k.weather?.replace("-", " ") ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{k.air != null ? `${k.air} °C` : "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{k.ground != null ? `${k.ground} °C` : "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{k.humidity != null ? `${k.humidity} %` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </>
        )}

        <Section id="schedule" title="Programme MotoGP" aside={<span className="text-xs text-muted-foreground">Heures de Paris</span>}>
          {sessions.isLoading ? <div className="h-40 animate-pulse rounded-md bg-muted" /> : !sessionList.length
            ? <p className="text-sm text-muted-foreground">Le programme détaillé n'est pas encore publié.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {sessionList.map((x) => {
                  const done = x.status === "FINISHED" || x.status === "Official";
                  return (
                    <li key={x.id}>
                      <button type="button" disabled={!done} onClick={() => setSessionId(x.id)} aria-pressed={sessionId === x.id}
                        className={cn("w-full rounded-md border p-3 text-left transition-colors disabled:cursor-default",
                          sessionId === x.id ? "border-plate bg-plate/10" : "border-border bg-card", done && "hover:border-foreground/40")}>
                        <span className="block font-semibold">{SESSION_LABEL[x.type] ?? x.type}{x.number ? ` ${x.number}` : ""}</span>
                        <span className="block text-sm capitalize text-muted-foreground">{paris(x.date, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span>
                        {done && x.condition?.track && <span className={cn("mt-1 block text-xs", x.condition.track !== "Dry" ? "text-wet" : "text-muted-foreground")}>
                          Piste {x.condition.track === "Dry" ? "sèche" : "mouillée"} · sol {x.condition.ground}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </Section>

        {sessionId && (
          <Section id="results" title={`Résultats · ${(() => { const x = sessionList.find((y) => y.id === sessionId); return x ? `${SESSION_LABEL[x.type] ?? x.type}${x.number ? ` ${x.number}` : ""}` : ""; })()}`}>
            {results.isLoading ? <div className="h-64 animate-pulse rounded-md bg-muted" /> : (
              <div className="overflow-x-auto rounded-md border border-border bg-card">
                <table className="w-full min-w-[40rem] text-sm [&_td]:whitespace-nowrap">
                  <thead className="border-b border-border text-left text-xs text-muted-foreground">
                    <tr>{["Pos.", "Pilote", "Moto", "Temps / écart", "Meilleur tour", "Vitesse max"].map((h, i) => <th key={h} scope="col" className={cn("px-3 py-2 font-semibold", i > 2 && "text-right")}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {((results.data ?? []) as unknown as ResultLite[]).map((r, i) => {
                      const rider = r.rider?.legacy_id ? byLegacy.get(r.rider.legacy_id) : undefined;
                      return (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-plate">{r.position ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <NumberPlate number={r.rider?.number ?? rider?.number} team={rider?.team} constructor={r.constructor?.name} size="xs" />
                              <span className="font-semibold">{r.rider?.full_name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{r.constructor?.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.position == null ? "Abandon" : r.position === 1 ? (r.time ?? r.best_lap?.time ?? "") : r.gap?.first ? `+${r.gap.first}` : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.best_lap?.time ?? "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.top_speed ? speed(r.top_speed) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {s && Object.values(s.files).some((f) => f?.url) && (
          <Section id="documents" title="Documents officiels">
            <ul className="flex flex-wrap gap-2">
              {Object.entries(s.files).filter(([, f]) => f?.url).map(([name, f]) => (
                <li key={name}>
                  <a href={f!.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
                    {{ circuit_information: "Fiche circuit", podiums: "Podiums", pole_positions: "Poles", nations_statistics: "Statistiques par nation", riders_all_time: "Pilotes, tous temps" }[name] ?? name.replace(/_/g, " ")}
                    <ExternalLink size={12} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <p className="mt-10 text-sm text-muted-foreground">
          <Link to="/calendar" className="font-semibold underline">Tous les Grands Prix</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default EventDetail;

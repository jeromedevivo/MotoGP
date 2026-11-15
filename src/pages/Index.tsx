import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NumberPlate from "@/components/NumberPlate";
import { getCategories, getCurrentSeason, getEvents, getRiderStandings } from "@/lib/api";
import { RANKINGS, formatPercent, formatRankingValue, getPredictionBoard, getRankings, shortName } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { ForecastDayCell } from "@/pages/Predictions";
import { useRiderIndex } from "@/pages/Riders";

const SPOTLIGHT = ["wet", "bike", "positions", "momentum"];
const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString("fr-FR", opts);

function useSeasonContext() {
  const season = useQuery({ queryKey: ["current-season"], queryFn: getCurrentSeason });
  const categories = useQuery({ queryKey: ["categories", season.data?.id], queryFn: () => getCategories(season.data!.id), enabled: !!season.data });
  const events = useQuery({ queryKey: ["events", season.data?.id, "all"], queryFn: () => getEvents(season.data!.id), enabled: !!season.data });
  const races = useMemo(() => (events.data ?? []).filter((e) => !(e as { test?: boolean }).test)
    .sort((a, b) => a.date_start.localeCompare(b.date_start)), [events.data]);
  const next = races.find((e) => e.status !== "FINISHED") ?? races[races.length - 1];
  return { season: season.data, categories: categories.data ?? [], races, next };
}

/** The next Grand Prix as the page's lead: name, dates, weekend weather and the favourites on their plates. */
const NextGrandPrix: React.FC<{ ctx: ReturnType<typeof useSeasonContext> }> = ({ ctx }) => {
  const motogp = ctx.categories.find((c) => c.name.startsWith("MotoGP"));
  const board = useQuery({
    queryKey: ["prediction-board", ctx.next?.id, motogp?.id, "forecast"],
    queryFn: () => getPredictionBoard(ctx.next!.id, motogp!.id), enabled: !!ctx.next && !!motogp, retry: false,
  });
  const { byLegacy } = useRiderIndex();
  const ev = ctx.next;
  if (!ev) return <div className="h-64 animate-pulse rounded-md bg-muted" aria-label="Chargement" />;
  const finished = ev.status === "FINISHED";
  return (
    <section aria-labelledby="next-gp" className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="min-w-0">
        <h1 id="next-gp" className="font-display text-3xl md:text-5xl">{ev.sponsored_name || ev.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {finished ? "Dernier Grand Prix de la saison" : "Prochain Grand Prix"} · {ev.circuit?.name} · {day(ev.date_start, { day: "numeric", month: "long" })} – {day(ev.date_end, { day: "numeric", month: "long" })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/events/${ev.id}`} className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted">Fiche du Grand Prix</Link>
          <Link to="/predictions" className="inline-flex items-center rounded-md bg-plate px-3 py-2 text-sm font-semibold text-plate-ink">Prédiction complète</Link>
        </div>
      </div>
      {board.data && board.data.weather.days.length > 0 && (
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-border bg-card p-1" aria-label="Météo du week-end">
          {board.data.weather.days.map((d, i, all) => <ForecastDayCell key={d.date} day={d} race={i === all.length - 1} />)}
        </div>
      )}
      <ol className="grid gap-2 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-5" aria-label="Favoris">
        {board.isLoading && Array.from({ length: 5 }).map((_, i) => <li key={i} className="h-[4.25rem] animate-pulse rounded-md bg-muted" />)}
        {board.data?.predictions.slice(0, 5).map((p) => {
          const rider = byLegacy.get(p.rider_id);
          return (
            <li key={p.rider_id}>
              <Link to={rider ? `/riders/${rider.id}` : "/predictions"} className="flex items-center gap-3 rounded-md border border-border bg-card p-3 hover:border-foreground/40">
                <NumberPlate number={p.number} team={rider?.team} constructor={p.constructor} size="md" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{shortName(p.rider)}</span>
                  <span className="text-lg font-extrabold leading-none">{formatPercent(p.win)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

const Championship: React.FC<{ ctx: ReturnType<typeof useSeasonContext> }> = ({ ctx }) => {
  const [cat, setCat] = useState("MotoGP");
  const category = ctx.categories.find((c) => c.name.startsWith(cat));
  const standings = useQuery({
    queryKey: ["standings", ctx.season?.id, category?.id], queryFn: () => getRiderStandings(ctx.season!.id, category!.id),
    enabled: !!ctx.season && !!category,
  });
  const { byLegacy } = useRiderIndex();
  const rows = (standings.data ?? []).slice(0, 10);
  const leader = rows[0]?.points ?? 0;
  return (
    <section aria-labelledby="championship">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="championship" className="font-display text-xl">Championnat {ctx.season?.year}</h2>
        <div role="radiogroup" aria-label="Catégorie" className="inline-flex rounded-md border border-border bg-card p-1">
          {["MotoGP", "Moto2", "Moto3"].map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(c)}
              className={cn("rounded px-3 py-1 text-sm font-semibold", cat === c ? "bg-plate text-plate-ink" : "text-muted-foreground hover:text-foreground")}>{c}</button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        {standings.isLoading ? <div className="h-96 animate-pulse bg-muted" /> : (
          <ol>
            {rows.map((s) => {
              const legacy = (s.rider as { legacy_id?: number }).legacy_id;
              const rider = legacy ? byLegacy.get(legacy) : undefined;
              return (
                <li key={s.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-3 py-2 first:border-t-0">
                  <span className="font-plate text-right text-muted-foreground">{s.position}</span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <NumberPlate number={s.rider.number ?? rider?.number} team={rider?.team} constructor={s.constructor?.name} size="xs" />
                    <span className="min-w-0">
                      {rider ? <Link to={`/riders/${rider.id}`} className="block truncate font-semibold hover:underline">{s.rider.full_name}</Link>
                        : <span className="block truncate font-semibold">{s.rider.full_name}</span>}
                      <span className="block truncate text-xs text-muted-foreground">{s.team?.name}</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold tabular-nums">{s.points}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">{s.position > 1 ? `−${leader - s.points}` : "leader"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <Link to="/standings" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline">Classement complet <ArrowRight size={14} aria-hidden /></Link>
    </section>
  );
};

const Upcoming: React.FC<{ ctx: ReturnType<typeof useSeasonContext> }> = ({ ctx }) => {
  const later = ctx.races.filter((e) => e.status !== "FINISHED" && e.id !== ctx.next?.id);
  const last = ctx.races.filter((e) => e.status === "FINISHED").slice(-3).reverse();
  const row = (e: (typeof ctx.races)[number], done: boolean) => (
    <li key={e.id}>
      <Link to={`/events/${e.id}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 border-t border-border px-3 py-2.5 hover:bg-muted/50">
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">{day(e.date_start, { day: "numeric", month: "short" })}</span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{e.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{e.circuit?.name}{done ? " · terminé" : ""}</span>
        </span>
      </Link>
    </li>
  );
  return (
    <section aria-labelledby="season">
      <h2 id="season" className="mb-4 font-display text-xl">La saison</h2>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">À venir</p>
        <ul>{later.length ? later.map((e) => row(e, false)) : <li className="border-t border-border px-3 py-2.5 text-sm text-muted-foreground">Rien d'autre cette saison.</li>}</ul>
        <p className="border-t border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Derniers Grands Prix</p>
        <ul>{last.map((e) => row(e, true))}</ul>
      </div>
      <Link to="/calendar" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline">Tout le calendrier <ArrowRight size={14} aria-hidden /></Link>
    </section>
  );
};

/** Four rankings that answer the questions fans actually ask, each with its leaders. */
const Spotlight: React.FC = () => {
  const rankings = useQuery({ queryKey: ["rankings", "MotoGP"], queryFn: () => getRankings("MotoGP"), retry: false });
  const { byLegacy } = useRiderIndex();
  if (!rankings.data) return null;
  return (
    <section className="mt-12" aria-labelledby="spotlight">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="spotlight" className="font-display text-xl">Les meilleurs, classement par classement</h2>
        <Link to="/riders" className="inline-flex items-center gap-1 text-sm font-semibold underline">Les 16 classements <ArrowRight size={14} aria-hidden /></Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SPOTLIGHT.map((key) => {
          const meta = RANKINGS[key];
          const top = rankings.data.rankings[key]?.slice(0, 3) ?? [];
          return (
            <li key={key} className="rounded-md border border-border bg-card p-4">
              <p className="font-semibold">{meta.label}</p>
              <ol className="mt-3 space-y-2">
                {top.map((item) => {
                  const rider = byLegacy.get(item.rider_id);
                  return (
                    <li key={item.rider_id} className="flex items-center gap-2 text-sm">
                      <span className="w-4 font-plate text-muted-foreground">{item.rank}</span>
                      <NumberPlate number={rider?.number} team={rider?.team} constructor={item.constructor} size="xs" />
                      {rider ? <Link to={`/riders/${rider.id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{item.rider}</Link>
                        : <span className="min-w-0 flex-1 truncate font-semibold">{item.rider}</span>}
                      <span className="tabular-nums text-muted-foreground">{formatRankingValue(item, meta)}</span>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const Index: React.FC = () => {
  const ctx = useSeasonContext();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <NextGrandPrix ctx={ctx} />
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Championship ctx={ctx} />
          <Upcoming ctx={ctx} />
        </div>
        <Spotlight />
      </main>
      <Footer />
    </div>
  );
};

export default Index;

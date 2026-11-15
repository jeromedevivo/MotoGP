import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Swords } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NumberPlate from "@/components/NumberPlate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllRiders } from "@/lib/api";
import {
  RANKINGS, RankingItem, RankingMeta, constructorColor, formatRankingValue, getHeadToHead, getRankings, ordinal, shortName,
} from "@/lib/insights";
import { cn } from "@/lib/utils";
import { NotReady } from "@/pages/Predictions";
import type { Rider } from "@/types";

const CATEGORIES = ["MotoGP", "Moto2", "Moto3"];
const GROUPS: RankingMeta["group"][] = ["Conditions", "Moto & pilotage", "Course", "Circuits"];

const categoryOf = (rider: Rider) => rider.category?.name?.replace("™", "").trim();

export function useRiderIndex(category?: string) {
  const riders = useQuery({ queryKey: ["riders"], queryFn: getAllRiders, staleTime: 3600_000 });
  return useMemo(() => {
    const all = riders.data ?? [];
    return {
      byLegacy: new Map(all.filter((r) => r.legacy_id).map((r) => [r.legacy_id as number, r])),
      grid: category ? all.filter((r) => categoryOf(r) === category) : all,
      loading: riders.isLoading,
    };
  }, [riders.data, riders.isLoading, category]);
}

const RiderCell: React.FC<{ item: Pick<RankingItem, "rider_id" | "rider" | "constructor">; rider?: Rider; compact?: boolean }> = ({ item, rider, compact }) => (
  <span className="flex min-w-0 items-center gap-2">
    <NumberPlate number={rider?.number} team={rider?.team} constructor={item.constructor} size="xs" />
    {rider ? (
      <Link to={`/riders/${rider.id}`} className="truncate font-semibold hover:underline">{compact ? shortName(item.rider) : item.rider}</Link>
    ) : <span className="truncate font-semibold">{compact ? shortName(item.rider) : item.rider}</span>}
  </span>
);

/** Who leads what: one row per ranking, the podium of each. */
const LeadersBoard: React.FC<{ rankings: Record<string, RankingItem[]>; riders: Map<number, Rider>; onOpen: (key: string) => void }> = ({
  rankings, riders, onOpen,
}) => (
  <div className="overflow-x-auto rounded-md border border-border bg-card">
    <table className="w-full min-w-[44rem] text-sm">
      <thead className="text-left text-xs text-muted-foreground">
        <tr className="border-b border-border">
          <th scope="col" className="px-3 py-2 font-semibold">Classement</th>
          <th scope="col" className="px-3 py-2 font-semibold">1er</th>
          <th scope="col" className="px-3 py-2 font-semibold">2e</th>
          <th scope="col" className="px-3 py-2 font-semibold">3e</th>
          <th scope="col"><span className="sr-only">Ouvrir</span></th>
        </tr>
      </thead>
      {GROUPS.map((group) => (
        <tbody key={group}>
          <tr><th colSpan={5} scope="rowgroup" className="bg-muted/50 px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">{group}</th></tr>
          {Object.entries(RANKINGS).filter(([, meta]) => meta.group === group).map(([key, meta]) => (
            <tr key={key} className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left font-semibold">{meta.label}</th>
              {[0, 1, 2].map((i) => {
                const item = rankings[key]?.[i];
                return (
                  <td key={i} className="px-3 py-2">
                    {item ? (
                      <span className="flex items-center justify-between gap-2">
                        <RiderCell item={item} rider={riders.get(item.rider_id)} compact />
                        <span className="text-xs tabular-nums text-muted-foreground">{formatRankingValue(item, meta)}</span>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                );
              })}
              <td className="pr-2 text-right">
                <button type="button" onClick={() => onOpen(key)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"
                  aria-label={`Voir tout le classement ${meta.label}`}>
                  <ArrowRight size={16} aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  </div>
);

export function extraLine(item: RankingItem, key: string): string {
  const pct = (v?: number) => (v == null ? "—" : Math.round(v * 100));
  switch (key) {
    case "wet": case "dry": case "hot": case "cold": case "fast": case "technical": case "left": case "right":
      return `${item.n} sessions · ${item.delta != null && item.delta >= 0 ? "+" : ""}${pct(item.delta)} vs son niveau habituel`;
    case "bike": return `${item.n} sessions face aux autres pilotes de la marque`;
    case "qualifying": return `grille moyenne ${item.avg?.toFixed(1).replace(".", ",")} · ${item.poles ?? 0} pole(s) · ${item.n} départs`;
    case "consistency": return `arrivée moyenne P${item.avg?.toFixed(1).replace(".", ",")} · ${item.n} courses`;
    case "reliability": return `${item.dnf} abandon(s) sur ${item.n} départs`;
    case "sprint": return `sprint ${pct(item.sprint)} · course ${pct(item.race)}`;
    case "momentum": return `5 dernières : ${(item.results as Array<number | null> | undefined)?.map((p) => (p ? `P${p}` : "Ab.")).join(" · ")}`;
    case "home": return `domicile ${pct(item.home)} · ailleurs ${pct(item.away)} · ${item.n} courses à domicile`;
    default: return `${item.n} courses`;
  }
}

const RankingDetail: React.FC<{ rankingKey: string; items: RankingItem[]; riders: Map<number, Rider> }> = ({ rankingKey, items, riders }) => {
  const meta = RANKINGS[rankingKey];
  const max = Math.max(...items.map((i) => Math.abs(i.score)), 0.0001);
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h3 className="font-display text-lg">{meta.label}</h3>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{meta.description}</p>
      </div>
      {items.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Pas assez de données pour cette catégorie.</p> : (
        <ol>
          {items.map((item) => {
            const rider = riders.get(item.rider_id);
            const top = item.rank <= 3;
            return (
              <li key={item.rider_id} className={cn("grid grid-cols-[2rem_minmax(0,1fr)_3rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(4rem,8rem)_3.5rem] items-center gap-3 border-t border-border px-4 first:border-t-0", top ? "py-3" : "py-2")}>
                <span className={cn("font-plate text-right", top ? "text-2xl" : "text-base text-muted-foreground")}>{item.rank}</span>
                <span className="min-w-0">
                  <RiderCell item={item} rider={rider} />
                  {/* rank earns apparatus: the leaders show how the score was earned */}
                  <span className={cn("block truncate text-xs text-muted-foreground", !top && "sr-only")}>
                    {item.constructor} · {extraLine(item, rankingKey)}
                  </span>
                </span>
                <span className="hidden h-2 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${(Math.abs(item.score) / max) * 100}%`, backgroundColor: constructorColor(item.constructor) }} />
                </span>
                <span className="text-right font-bold tabular-nums">{formatRankingValue(item, meta)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

const H2H_LABELS: Record<string, string> = { total: "Toutes", dry: "Sur le sec", wet: "Sous la pluie", RAC: "Courses", SPR: "Sprints" };

const Duel: React.FC<{ grid: Rider[]; rankings: Record<string, RankingItem[]> }> = ({ grid, rankings }) => {
  const sorted = useMemo(() => [...grid].filter((r) => r.legacy_id).sort((a, b) => a.full_name.localeCompare(b.full_name)), [grid]);
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const ra = sorted.find((r) => r.id === a);
  const rb = sorted.find((r) => r.id === b);
  const h2h = useQuery({
    queryKey: ["h2h", ra?.legacy_id, rb?.legacy_id],
    queryFn: () => getHeadToHead(ra!.legacy_id!, rb!.legacy_id!),
    enabled: !!ra?.legacy_id && !!rb?.legacy_id && a !== b,
  });

  const picker = (value: string, set: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger aria-label={label}><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>{sorted.map((r) => <SelectItem key={r.id} value={r.id}>{r.number ? `${r.number} · ` : ""}{r.full_name}</SelectItem>)}</SelectContent>
    </Select>
  );

  const bucket = (key: string) => {
    const v = h2h.data?.[key];
    if (!v || !v.n) return null;
    const share = v.a / v.n;
    return (
      <div key={key} className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3 text-sm">
        <span className="text-right font-bold tabular-nums">{v.a}</span>
        <span>
          <span className="mb-1 block text-center text-xs text-muted-foreground">{H2H_LABELS[key]} · {v.n} courses ensemble</span>
          <span className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span style={{ width: `${share * 100}%`, backgroundColor: ra?.team?.color || constructorColor(ra?.constructor?.name) }} />
            <span style={{ width: `${(1 - share) * 100}%`, backgroundColor: rb?.team?.color || constructorColor(rb?.constructor?.name) }} />
          </span>
        </span>
        <span className="font-bold tabular-nums">{v.b}</span>
      </div>
    );
  };

  const rankOf = (rider: Rider | undefined, key: string) => rankings[key]?.find((i) => i.rider_id === rider?.legacy_id);

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        {picker(a, setA, "Premier pilote")}
        <Swords size={18} className="mx-auto text-muted-foreground" aria-hidden />
        {picker(b, setB, "Second pilote")}
      </div>
      {!(ra && rb) && <p className="mt-4 text-sm text-muted-foreground">Choisissez deux pilotes pour comparer leurs arrivées communes et leur rang dans chaque classement.</p>}
      {ra && rb && a !== b && (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Qui finit devant l'autre (depuis 2018)</p>
            {h2h.isLoading && <p className="text-sm text-muted-foreground">Calcul…</p>}
            {h2h.data && (h2h.data.total.n === 0
              ? <p className="text-sm text-muted-foreground">Ces deux pilotes n'ont jamais terminé la même course.</p>
              : ["total", "dry", "wet", "RAC", "SPR"].map(bucket))}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Rang dans chaque classement</p>
            <table className="w-full text-sm">
              <thead className="sr-only"><tr><th>{ra.full_name}</th><th>Classement</th><th>{rb.full_name}</th></tr></thead>
              <tbody>
                {Object.entries(RANKINGS).map(([key, meta]) => {
                  const x = rankOf(ra, key);
                  const y = rankOf(rb, key);
                  if (!x && !y) return null;
                  const better = x && y ? (x.rank < y.rank ? "a" : "b") : null;
                  return (
                    <tr key={key} className="border-t border-border">
                      <td className={cn("py-1.5 text-right tabular-nums", better === "a" ? "font-bold" : "text-muted-foreground")}>{x ? ordinal(x.rank) : "—"}</td>
                      <td className="px-3 py-1.5 text-center">{meta.label}</td>
                      <td className={cn("py-1.5 tabular-nums", better === "b" ? "font-bold" : "text-muted-foreground")}>{y ? ordinal(y.rank) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const GridByTeam: React.FC<{ grid: Rider[] }> = ({ grid }) => {
  const teams = useMemo(() => {
    const map = new Map<string, Rider[]>();
    for (const r of grid) {
      const key = r.team?.name ?? "Équipe à confirmer";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].sort((x, y) => (x[1][0].constructor?.name ?? "").localeCompare(y[1][0].constructor?.name ?? ""));
  }, [grid]);
  if (!grid.length) return <div className="h-64 animate-pulse rounded-md bg-muted" aria-label="Chargement" />;
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map(([team, riders]) => (
        <div key={team}>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: riders[0].team?.color || constructorColor(riders[0].constructor?.name) }} aria-hidden />
            {team}
          </p>
          <ul className="space-y-1.5">
            {riders.map((r) => (
              <li key={r.id}>
                <Link to={`/riders/${r.id}`} className="flex items-center gap-3 rounded-md border border-border bg-card p-2 pr-3 transition-colors hover:border-foreground/40">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                    {r.picture && <img src={r.picture} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.country?.name}{r.wildcard ? " · wildcard" : ""}{r.injured ? " · blessé" : ""}</span>
                  </span>
                  <NumberPlate number={r.number} team={r.team} constructor={r.constructor?.name} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const RidersPage: React.FC = () => {
  const [category, setCategory] = useState("MotoGP");
  const [selected, setSelected] = useState("wet");
  const rankings = useQuery({
    queryKey: ["rankings", category], queryFn: () => getRankings(category),
    retry: (count, error) => (error as { status?: number }).status === 503 && count < 40, retryDelay: 15000,
  });
  const { byLegacy, grid } = useRiderIndex(category);

  const open = (key: string) => {
    setSelected(key);
    document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl md:text-4xl">Pilotes</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Qui est le meilleur sous la pluie, qui tire le plus de sa moto, qui remonte le mieux : seize classements calculés
              sur tous les résultats depuis 2018{rankings.data ? `, pour la grille ${rankings.data.year}` : ""}.
            </p>
          </div>
          <div role="radiogroup" aria-label="Catégorie" className="inline-flex self-start rounded-md border border-border bg-card p-1 md:self-auto">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)}
                className={cn("rounded px-3 py-1.5 text-sm font-semibold", category === c ? "bg-plate text-plate-ink" : "text-muted-foreground hover:text-foreground")}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <section className="mt-8" aria-labelledby="leaders-title">
          <h2 id="leaders-title" className="mb-4 font-display text-xl">Qui domine quoi</h2>
          {rankings.error ? <NotReady error={rankings.error} /> : !rankings.data
            ? <div className="h-96 animate-pulse rounded-md bg-muted" aria-label="Chargement" />
            : <LeadersBoard rankings={rankings.data.rankings} riders={byLegacy} onOpen={open} />}
        </section>

        {rankings.data && (
          <section id="detail" className="mt-12 scroll-mt-20" aria-labelledby="detail-title">
            <h2 id="detail-title" className="mb-4 font-display text-xl">Classement complet</h2>
            <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
              <nav aria-label="Choisir un classement" className="flex gap-4 overflow-x-auto pb-1 lg:flex-col">
                {GROUPS.map((group) => (
                  <div key={group} className="min-w-max">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{group}</p>
                    <ul className="flex gap-1 lg:flex-col">
                      {Object.entries(RANKINGS).filter(([, m]) => m.group === group).map(([key, meta]) => (
                        <li key={key}>
                          <button type="button" onClick={() => setSelected(key)} aria-current={selected === key}
                            className={cn("w-full rounded px-2.5 py-1.5 text-left text-sm font-semibold",
                              selected === key ? "bg-plate text-plate-ink" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                            {meta.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
              <RankingDetail rankingKey={selected} items={rankings.data.rankings[selected] ?? []} riders={byLegacy} />
            </div>
          </section>
        )}

        <section className="mt-12" aria-labelledby="duel-title">
          <h2 id="duel-title" className="mb-4 font-display text-xl">Duel face à face</h2>
          <Duel grid={grid} rankings={rankings.data?.rankings ?? {}} />
        </section>

        <section className="mt-12" aria-labelledby="grid-title">
          <h2 id="grid-title" className="mb-4 font-display text-xl">La grille {category}</h2>
          <GridByTeam grid={grid} />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default RidersPage;

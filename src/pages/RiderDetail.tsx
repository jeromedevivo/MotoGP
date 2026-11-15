import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CloudRain } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NumberPlate from "@/components/NumberPlate";
import { getRiderDetails } from "@/lib/api";
import { RANKINGS, RankingItem, RiderInsights, constructorColor, formatRankingValue, getRiderInsights, ordinal } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { extraLine } from "@/pages/Riders";

const age = (birth?: string) => {
  if (!birth) return null;
  const d = new Date(birth);
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
};

const Profile: React.FC<{ insights: RiderInsights }> = ({ insights }) => {
  const rows = Object.entries(RANKINGS).filter(([key]) => insights.ranks[key]);
  const color = constructorColor(insights.constructor);
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Classement</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Rang</th>
            <th scope="col" className="w-1/4 px-3 py-2 font-semibold">Place dans la grille</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Valeur</th>
            <th scope="col" className="px-3 py-2 font-semibold">Base de calcul</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, meta]) => {
            const r = insights.ranks[key];
            const percentile = r.of > 1 ? 1 - (r.rank - 1) / (r.of - 1) : 1;
            return (
              <tr key={key} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-semibold" title={meta.description}>{meta.label}</th>
                <td className="whitespace-nowrap px-3 py-2 text-right"><strong>{ordinal(r.rank)}</strong><span className="text-muted-foreground"> / {r.of}</span></td>
                <td className="px-3 py-2">
                  <span className="relative block h-2 rounded-full bg-muted" aria-hidden>
                    <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                      style={{ left: `${percentile * 100}%`, backgroundColor: color }} />
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">{formatRankingValue(r, meta)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{extraLine({ ...r, rider: insights.rider } as RankingItem, key)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const RiderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const rider = useQuery({ queryKey: ["rider", id], queryFn: () => getRiderDetails(id || ""), enabled: !!id });
  const legacy = rider.data?.legacy_id;
  const insights = useQuery({ queryKey: ["rider-insights", legacy], queryFn: () => getRiderInsights(legacy!), enabled: !!legacy, retry: false });

  const stats = rider.data?.statistics ?? [];
  const totals = useMemo(() => stats.reduce((t, s) => ({
    titles: t.titles + (s.position === 1 ? 1 : 0), wins: t.wins + (s.first_position || 0), podiums: t.podiums + (s.podiums || 0),
    poles: t.poles + (s.poles || 0), starts: t.starts + (s.starts || 0),
  }), { titles: 0, wins: 0, podiums: 0, poles: 0, starts: 0 }), [stats]);

  if (rider.isLoading) {
    return <div className="min-h-screen bg-background"><Header /><main className="container py-8"><div className="h-72 animate-pulse rounded-md bg-muted" aria-label="Chargement" /></main></div>;
  }
  if (rider.error || !rider.data) {
    return (
      <div className="min-h-screen bg-background"><Header />
        <main className="container py-20 text-center">
          <h1 className="font-display text-2xl">Pilote introuvable</h1>
          <Link to="/riders" className="mt-4 inline-block font-semibold underline">Retour aux pilotes</Link>
        </main><Footer />
      </div>
    );
  }

  const r = rider.data;
  const years = age(r.birth_date);
  const data = insights.data;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <Link to="/riders" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} aria-hidden /> Tous les pilotes
        </Link>

        <section className="mt-4 grid items-end gap-6 overflow-hidden rounded-md border border-border bg-card md:grid-cols-[1fr_auto]">
          <div className="p-6">
            <NumberPlate number={r.number} team={r.team} constructor={r.constructor?.name} size="xl" />
            <h1 className="mt-5 font-display text-4xl md:text-5xl">{r.full_name}</h1>
            <p className="mt-1 text-lg text-muted-foreground">{r.team?.name ?? "Équipe à confirmer"} · {r.constructor?.name}</p>
            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Pays</dt><dd className="font-semibold">{r.country?.name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Âge</dt><dd className="font-semibold">{years != null ? `${years} ans` : "—"}{r.birth_city ? ` · ${r.birth_city}` : ""}</dd></div>
              <div><dt className="text-muted-foreground">Taille · poids</dt><dd className="font-semibold">{r.physical_attributes?.height ? `${r.physical_attributes.height} cm` : "—"}{r.physical_attributes?.weight ? ` · ${r.physical_attributes.weight} kg` : ""}</dd></div>
              <div><dt className="text-muted-foreground">Catégorie</dt><dd className="font-semibold">{r.category?.name ?? "—"}{r.injured ? " · blessé" : ""}</dd></div>
            </dl>
          </div>
          {r.picture && <img src={r.picture} alt={r.full_name} className="mx-auto h-72 max-w-full object-contain object-bottom md:h-80" />}
        </section>

        <section className="mt-6 grid grid-cols-5 divide-x divide-border rounded-md border border-border bg-card text-center" aria-label="Palmarès en carrière">
          {[["Titres", totals.titles], ["Victoires", totals.wins], ["Podiums", totals.podiums], ["Poles", totals.poles], ["Départs", totals.starts]].map(([label, value]) => (
            <div key={label as string} className="px-2 py-4">
              <p className="font-plate text-2xl md:text-3xl">{value}</p>
              <p className="text-xs text-muted-foreground md:text-sm">{label}</p>
            </div>
          ))}
        </section>

        {data && data.highlights.length > 0 && (
          <section className="mt-10" aria-labelledby="strengths">
            <h2 id="strengths" className="mb-3 font-display text-xl">Ses points forts</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.highlights.map((h) => (
                <li key={h.key} className="rounded-md border border-border bg-card p-4">
                  <p className="font-plate text-3xl">{ordinal(h.rank)}<span className="ml-1 font-sans text-sm font-normal not-italic text-muted-foreground">sur {h.of}</span></p>
                  <p className="mt-1 font-semibold">{RANKINGS[h.key]?.label}</p>
                  <p className="text-xs text-muted-foreground">{extraLine({ ...h, rider: data.rider } as RankingItem, h.key)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10" aria-labelledby="profile">
          <h2 id="profile" className="mb-1 font-display text-xl">Profil complet</h2>
          <p className="mb-4 text-sm text-muted-foreground">Son rang parmi les pilotes de sa catégorie, pour chaque classement. Survolez un classement pour voir comment il est calculé.</p>
          {insights.isLoading ? <div className="h-80 animate-pulse rounded-md bg-muted" />
            : data ? <Profile insights={data} />
            : <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">Pas de résultats depuis 2018 pour ce pilote, ou l'historique est encore en construction.</p>}
        </section>

        {data && data.circuits.length > 0 && (
          <section className="mt-10" aria-labelledby="circuits">
            <h2 id="circuits" className="mb-4 font-display text-xl">Circuit par circuit</h2>
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Circuit</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Départs</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Victoires</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Podiums</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Meilleur</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Moyenne</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Derniers résultats</th>
                  </tr>
                </thead>
                <tbody>
                  {data.circuits.map((c) => (
                    <tr key={c.circuit_id} className="border-t border-border">
                      <th scope="row" className="px-3 py-2 text-left font-semibold">{c.name ?? c.event}</th>
                      <td className="px-3 py-2 text-right tabular-nums">{c.starts}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.wins || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.podiums || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.best ? `P${c.best}` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.avg?.toFixed(1).replace(".", ",") ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          {c.results.slice(-6).map((x, i) => (
                            <span key={i} className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", x.pos === 1 ? "bg-plate text-plate-ink" : "bg-secondary")}
                              title={`${x.year} · ${x.category} · ${x.session === "SPR" ? "sprint" : "course"}`}>
                              {x.year % 100}{x.session === "SPR" ? "s" : ""} {x.pos ? `P${x.pos}` : "Ab."}
                              {x.track && x.track !== "Dry" && <CloudRain size={10} className="ml-0.5 inline text-wet" aria-label="mouillé" />}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {stats.length > 0 && (
          <section className="mt-10" aria-labelledby="seasons">
            <h2 id="seasons" className="mb-4 font-display text-xl">Saison par saison</h2>
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground">
                  <tr>
                    {["Saison", "Catégorie", "Moto", "Classement", "Points", "Victoires", "Podiums", "Poles", "Abandons"].map((h, i) => (
                      <th key={h} scope="col" className={cn("px-3 py-2 font-semibold", i > 2 && "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => {
                    const mine = data?.seasons.find((x) => String(x.year) === s.season && s.category.startsWith(x.category));
                    return (
                      <tr key={`${s.season}-${s.category}`} className="border-t border-border">
                        <td className="px-3 py-2 font-semibold">{s.season}</td>
                        <td className="px-3 py-2">{s.category.replace("™", "")}</td>
                        <td className="px-3 py-2">{s.constructor}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.position ? ordinal(s.position) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.points}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.first_position || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.podiums || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.poles || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{mine ? mine.dnf : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold">
          <Link to={`/riders/${id}/stats`} className="underline">Statistiques détaillées</Link>
          <Link to="/predictions" className="underline">Ses chances au prochain Grand Prix</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RiderDetail;

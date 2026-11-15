import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Calendar, Clock, MapPin } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSeason, getEvents, getLiveTiming } from "@/lib/api";

const LiveTimingPage: React.FC = () => {
  const [now, setNow] = useState(Date.now());
  const seasonQuery = useQuery({ queryKey: ["current-season"], queryFn: getCurrentSeason });
  const eventsQuery = useQuery({
    queryKey: ["events", seasonQuery.data?.id],
    queryFn: () => getEvents(seasonQuery.data!.id),
    enabled: !!seasonQuery.data?.id,
  });
  const timingQuery = useQuery({
    queryKey: ["live-timing"],
    queryFn: getLiveTiming,
    refetchInterval: 15000,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const nextEvent = useMemo(() => {
    const events = (eventsQuery.data || [])
      .filter((event) => new Date(event.date_end).getTime() >= now)
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
    return events[0];
  }, [eventsQuery.data, now]);

  const countdown = nextEvent
    ? Math.max(0, new Date(nextEvent.date_start).getTime() - now)
    : 0;
  const isLive = !!nextEvent
    && new Date(nextEvent.date_start).getTime() <= now
    && new Date(nextEvent.date_end).getTime() >= now;
  const days = Math.floor(countdown / 86400000);
  const hours = Math.floor((countdown % 86400000) / 3600000);
  const minutes = Math.floor((countdown % 3600000) / 60000);
  const seconds = Math.floor((countdown % 60000) / 1000);
  const timingAvailable = Boolean(
    timingQuery.data
    && typeof timingQuery.data === "object"
    && "active" in timingQuery.data
    && timingQuery.data.active,
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Activity className="text-racing-red" />
          <div>
            <h1 className="text-3xl font-bold">Live Timing</h1>
            <p className="text-muted-foreground">Chronomètre officiel lorsqu'une session est en cours</p>
          </div>
        </div>
        <Card className="mb-6">
          <CardHeader><CardTitle>Prochaine session / prochain Grand Prix</CardTitle></CardHeader>
          <CardContent>
            {eventsQuery.isLoading && <p>Chargement du calendrier...</p>}
            {!eventsQuery.isLoading && nextEvent && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h2 className="text-2xl font-bold">{nextEvent.sponsored_name || nextEvent.name}</h2>
                  <p className="mt-2 flex items-center text-muted-foreground">
                    <MapPin size={16} className="mr-2" /> {nextEvent.circuit?.name || "Circuit à confirmer"}
                  </p>
                  <p className="mt-2 flex items-center text-muted-foreground">
                    <Calendar size={16} className="mr-2" /> {new Date(nextEvent.date_start).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-racing-red p-6 text-center text-white">
                  <Clock className="mx-auto mb-2" />
                  <p className="text-sm uppercase tracking-wide">{isLive ? "Direct maintenant" : "Départ dans"}</p>
                  <p className="mt-2 text-3xl font-bold">
                    {isLive ? "En cours" : `${days}j ${hours}h ${minutes}m ${seconds}s`}
                  </p>
                </div>
              </div>
            )}
            {!eventsQuery.isLoading && !nextEvent && <p className="text-muted-foreground">Aucune course à venir.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Statut du direct</CardTitle></CardHeader>
          <CardContent>
            {timingAvailable ? (
              <p className="text-green-700">Une session de chronométrage est actuellement disponible.</p>
            ) : (
              <p className="text-muted-foreground">
                Aucun direct en cours. Le chronométrage s'activera automatiquement pendant la session officielle.
              </p>
            )}
            {timingQuery.error && <p className="mt-2 text-sm text-muted-foreground">Le flux live n'est pas disponible actuellement.</p>}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default LiveTimingPage;

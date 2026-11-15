import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Download, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentSeason, getEvents } from "@/lib/api";

const CalendarPage: React.FC = () => {
  const seasonQuery = useQuery({ queryKey: ["current-season"], queryFn: getCurrentSeason });
  const eventsQuery = useQuery({
    queryKey: ["events", seasonQuery.data?.id],
    queryFn: () => getEvents(seasonQuery.data!.id),
    enabled: !!seasonQuery.data?.id,
  });
  const events = [...(eventsQuery.data || [])]
    .filter((event) => {
      const rawEvent = event as typeof event & { test?: boolean };
      return !rawEvent.test && !event.name.toLowerCase().includes("test");
    })
    .sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
  );

  const exportCalendar = () => {
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MotoGP Insights//EN",
      ...events.flatMap((event) => [
        "BEGIN:VEVENT",
        `UID:${event.id}@motogp-insights`,
        `DTSTART:${format(new Date(event.date_start), "yyyyMMdd'T'HHmmss'Z'")}`,
        `DTEND:${format(new Date(event.date_end), "yyyyMMdd'T'HHmmss'Z'")}`,
        `SUMMARY:${event.sponsored_name || event.name}`,
        `LOCATION:${event.circuit?.name || ""}, ${event.country?.name || ""}`,
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/calendar" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `motogp-${seasonQuery.data?.year || "calendar"}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Calendrier MotoGP</h1>
            <p className="text-muted-foreground">Saison {seasonQuery.data?.year || "..."}</p>
          </div>
          <Button onClick={exportCalendar} disabled={!events.length}>
            <Download size={16} className="mr-2" /> Exporter
          </Button>
        </div>
        <Card>
          <CardHeader><CardTitle>Courses de la saison</CardTitle></CardHeader>
          <CardContent>
            {eventsQuery.isLoading && <p className="py-8 text-center">Chargement du calendrier...</p>}
            {eventsQuery.error && <p className="py-8 text-center text-red-600">Impossible de charger le calendrier.</p>}
            {!eventsQuery.isLoading && !eventsQuery.error && !events.length && (
              <p className="py-8 text-center text-muted-foreground">Aucune course disponible.</p>
            )}
            <div className="grid gap-3">
              {events.map((event, index) => {
                const upcoming = new Date(event.date_start) >= new Date();
                return (
                  <Link key={event.id} to={`/events/${event.id}`} className="rounded-lg border p-4 transition hover:border-racing-red">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div className="flex items-start gap-3">
                        <div className="rounded bg-racing-red p-2 text-white"><CalendarIcon size={20} /></div>
                        <div>
                          <p className="font-bold">{index + 1}. {event.sponsored_name || event.name}</p>
                          <p className="flex items-center text-sm text-muted-foreground">
                            <MapPin size={14} className="mr-1" /> {event.circuit?.name || "Circuit à confirmer"}{event.country?.name ? `, ${event.country.name}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="font-medium">{format(new Date(event.date_start), "dd MMMM yyyy", { locale: fr })}</p>
                        <p className={upcoming ? "text-green-600" : "text-muted-foreground"}>{upcoming ? "À venir" : "Terminée"}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default CalendarPage;

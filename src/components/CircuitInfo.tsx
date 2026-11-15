import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentSeason, getUpcomingEvents } from "@/lib/api";

const CircuitInfo: React.FC = () => {
  const seasonQuery = useQuery({ queryKey: ["current-season"], queryFn: getCurrentSeason });
  const eventsQuery = useQuery({
    queryKey: ["upcoming-events", seasonQuery.data?.id],
    queryFn: () => getUpcomingEvents(seasonQuery.data!.id),
    enabled: !!seasonQuery.data?.id,
  });
  const event = eventsQuery.data?.[0];
  const circuit = event?.circuit;

  if (seasonQuery.isLoading || eventsQuery.isLoading) {
    return <Card><CardContent className="p-6"><p className="text-center text-muted-foreground">Loading next circuit...</p></CardContent></Card>;
  }
  if (eventsQuery.error || !event || !circuit) {
    return <Card><CardContent className="p-6"><p className="text-center text-muted-foreground">No upcoming circuit information available.</p></CardContent></Card>;
  }

  const mapsUrl = circuit.lat && circuit.lng
    ? `https://maps.google.com/maps?q=${circuit.lat},${circuit.lng}&z=15&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(circuit.name)}&output=embed`;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-xl font-bold">Next Circuit</h3>
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar size={16} className="mr-1" />
            {new Date(event.date_start).toLocaleDateString()}
          </div>
        </div>
        <h4 className="text-lg font-bold">{circuit.name}</h4>
        <p className="mt-1 flex items-center text-muted-foreground">
          <MapPin size={16} className="mr-1" />
          {circuit.city}{circuit.city && circuit.country ? ", " : ""}{circuit.country}
        </p>
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-md border border-border">
          <iframe src={mapsUrl} width="100%" height="100%" style={{ border: 0 }} loading="lazy" title={`Map of ${circuit.name}`} />
        </div>
      </CardContent>
    </Card>
  );
};

export default CircuitInfo;

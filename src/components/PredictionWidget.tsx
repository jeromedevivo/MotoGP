import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCategories, getCurrentSeason, getEvents, getPredictions } from "@/lib/api";

const PredictionWidget: React.FC = () => {
  const seasonQuery = useQuery({ queryKey: ["current-season"], queryFn: getCurrentSeason });
  const categoriesQuery = useQuery({
    queryKey: ["categories", seasonQuery.data?.id],
    queryFn: () => getCategories(seasonQuery.data!.id),
    enabled: !!seasonQuery.data?.id,
  });
  const eventsQuery = useQuery({
    queryKey: ["events", seasonQuery.data?.id, "all"],
    queryFn: () => getEvents(seasonQuery.data!.id),
    enabled: !!seasonQuery.data?.id,
  });
  const category = categoriesQuery.data?.find((item) => item.name.toLowerCase().includes("motogp"))
    || categoriesQuery.data?.[0];
  // next unfinished GP; once the season is over, the last one
  const races = (eventsQuery.data ?? []).filter((e) => !(e as { test?: boolean }).test).sort((a, b) => a.date_start.localeCompare(b.date_start));
  const event = races.find((e) => e.status !== "FINISHED") ?? races[races.length - 1];
  const predictionsQuery = useQuery({
    queryKey: ["predictions", event?.id, category?.id],
    queryFn: () => getPredictions(event!.id, category!.id),
    enabled: !!event?.id && !!category?.id,
  });

  const getFormIcon = (form: string) => {
    if (form === "ascending") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (form === "descending") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
  };

  const loading = seasonQuery.isLoading || categoriesQuery.isLoading || eventsQuery.isLoading
    || predictionsQuery.isLoading;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">Favoris du prochain GP</CardTitle>
        <p className="text-sm text-muted-foreground">
          {event?.sponsored_name || event?.name || "Next Grand Prix"}
        </p>
      </CardHeader>
      <CardContent>
        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading predictions...</p>}
        {!loading && predictionsQuery.error && (
          <p className="py-8 text-center text-sm text-red-600">Predictions unavailable for this race.</p>
        )}
        {!loading && !predictionsQuery.error && predictionsQuery.data?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No predictions available.</p>
        )}
        {!loading && predictionsQuery.data && predictionsQuery.data.length > 0 && (
          <>
            <ScrollArea className="h-[250px]">
              <div className="space-y-2">
                {predictionsQuery.data.map((prediction, index) => (
                  <Link
                    key={prediction.rider.id}
                    to={`/riders/${prediction.rider.id}`}
                    className="block rounded-md transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-racing-red font-bold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{prediction.rider.full_name}</div>
                          <div className="text-sm text-muted-foreground">{prediction.rider.constructor?.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2 text-sm font-medium">
                          {(prediction.probability * 100).toFixed(0)}%
                        </span>
                        {getFormIcon(prediction.form)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-2 text-center text-xs text-muted-foreground">Calcul : historique depuis 2018, forme, moto, circuit et météo</div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PredictionWidget;

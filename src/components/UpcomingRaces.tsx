import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Event } from "@/types";
import RaceCard from "./RaceCard";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from "@/components/ui/carousel";
import { getCurrentSeason, getUpcomingEvents } from "@/lib/api";

const UpcomingRaces: React.FC = () => {
  const [races, setRaces] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRaces = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get current season first
      const currentSeason = await getCurrentSeason();
      // Then get upcoming events for that season
      const upcomingEvents = await getUpcomingEvents(currentSeason.id);
      setRaces(upcomingEvents);
    } catch (err) {
      console.error("Failed to fetch upcoming races:", err);
      setError("Impossible de charger les prochains Grands Prix. Réessayez plus tard.");
      toast({
        title: "Error",
        description: "Grands Prix indisponibles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRaces();
  }, []);

  const handleRefresh = () => {
    toast({
      title: "Actualisation",
      description: "Mise à jour des courses…",
    });
    fetchRaces();
  };

  return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Prochains Grands Prix</h2>
          <Link to="/calendar">
            <Button variant="ghost" className="text-racing-red flex items-center">
              Calendrier complet <ChevronRight size={16} className="ml-1" />
            </Button>
          </Link>
        </div>

        {loading ? (
            <div className="col-span-full text-center p-8 border border-dashed border-border rounded-lg">
              <p>Loading upcoming races...</p>
            </div>
        ) : error ? (
            <div className="col-span-full text-center p-8 border border-dashed border-border rounded-lg">
              <p>{error}</p>
              <Button onClick={handleRefresh} className="mt-4">
                Réessayer
              </Button>
            </div>
        ) : races.length > 0 ? (
            <Carousel className="w-full">
              <CarouselContent className="-ml-4">
                {races.map((race, index) => (
                    <CarouselItem key={race.id} className="pl-4 md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                      <div className="h-full">
                        <Link to={`/events/${race.id}`} className="block h-full">
                          <div className="h-full">
                            <RaceCard event={race} isNext={index === 0} />
                          </div>
                        </Link>
                      </div>
                    </CarouselItem>
                ))}
              </CarouselContent>
              <div className="flex justify-center mt-4 gap-2">
                <CarouselPrevious className="relative static left-0 translate-y-0 -translate-x-0" />
                <CarouselNext className="relative static right-0 translate-y-0 translate-x-0" />
              </div>
            </Carousel>
        ) : (
            <div className="col-span-full text-center p-8 border border-dashed border-border rounded-lg">
              <p>No upcoming races found.</p>
              <Button onClick={handleRefresh} className="mt-4">
                Refresh
              </Button>
            </div>
        )}
      </div>
  );
};

export default UpcomingRaces;
import React from "react";
import { Event, Circuit } from "@/types";
import { Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface RaceCardProps {
  event: Event;
  isNext?: boolean;
}

const RaceCard: React.FC<RaceCardProps> = ({ event, isNext = false }) => {
  const eventDate = new Date(event.date_start);
  const formattedDate = format(eventDate, "dd MMM yyyy");

  // Format the event name to be more readable
  const displayName = event.sponsored_name || event.name;

  // Get circuit name from the event
  const circuitName = event.circuit?.name || "TBC";

  // Get country name from the event
  const countryName = event.country?.name || "TBC";

  return (
      <div className={`race-card h-full flex flex-col ${isNext ? "border-racing-red" : ""}`}>
        {isNext && (
            <div className="bg-racing-red text-white px-4 py-1 text-sm font-medium">
              PROCHAIN GP
            </div>
        )}

        <div className="p-4 flex-1 flex flex-col">
          <div className="flex justify-between items-start flex-1">
            <div>
              <h3 className="font-bold text-lg line-clamp-2">{displayName}</h3>
              <p className="text-muted-foreground flex items-center mt-1">
                <MapPin size={16} className="mr-1" />
                <span className="line-clamp-1">{circuitName}, {countryName}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground flex items-center justify-end">
                <Calendar size={14} className="mr-1" />
                {formattedDate}
              </div>
            </div>
          </div>

          <div className="mt-4 flex space-x-2">
            <Button variant="default" className="bg-racing-red hover:bg-racing-red/90">
              Détails du GP
            </Button>
            <Button variant="outline">
              Ajouter au calendrier
            </Button>
          </div>
        </div>
      </div>
  );
};

export default RaceCard;
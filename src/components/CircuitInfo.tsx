
import React, { useState } from "react";
import { Circuit, Event } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar } from "lucide-react";

// Mock circuit data
const MOCK_NEXT_EVENT: Event = {
  id: "event-1",
  name: "Italian Grand Prix",
  sponsored_name: "Gran Premio d'Italia Oakley",
  country: {
    iso: "IT",
    name: "Italy",
  },
  circuit: {
    id: "circuit-1",
    name: "Mugello Circuit",
    country: "Italy",
    city: "Scarperia e San Piero",
    postal_code: "50038",
    address: "Via Senni, 15, 50038 Scarperia e San Piero FI, Italy",
    lat: "43.9975",
    lng: "11.3719",
    constructed: 1974,
    designer: "Jarno Saarinen",
    active: true,
  },
  date_start: "2025-05-30T12:00:00.000Z",
  date_end: "2025-06-01T16:00:00.000Z",
  status: "scheduled"
};

const CircuitInfo: React.FC = () => {
  const [nextEvent] = useState<Event | null>(MOCK_NEXT_EVENT);
  
  if (!nextEvent || !nextEvent.circuit) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">No upcoming circuit information available</p>
        </CardContent>
      </Card>
    );
  }
  
  const circuit = nextEvent.circuit;
  
  // Create Google Maps URL using lat and lng if available
  const mapsUrl = circuit.lat && circuit.lng 
    ? `https://maps.google.com/maps?q=${circuit.lat},${circuit.lng}&z=15&output=embed` 
    : `https://maps.google.com/maps?q=${encodeURIComponent(circuit.name || '')}&output=embed`;
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold">Next Circuit</h3>
          <div className="text-sm text-gray-500 flex items-center">
            <Calendar size={16} className="mr-1" />
            {new Date(nextEvent.date_start).toLocaleDateString()}
          </div>
        </div>
        
        <div className="mb-4">
          <h4 className="font-bold text-lg">{circuit.name}</h4>
          <p className="text-gray-600 flex items-center mt-1">
            <MapPin size={16} className="mr-1" />
            {circuit.city}{circuit.city && circuit.country ? ", " : ""}{circuit.country}
          </p>
        </div>
        
        <div className="aspect-video w-full overflow-hidden rounded-md border border-border mb-4">
          <iframe 
            src={mapsUrl}
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map of ${circuit.name}`}
          />
        </div>
        
        {circuit.constructed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-sm text-gray-500">Built</div>
              <div className="font-bold">{circuit.constructed}</div>
            </div>
            {circuit.designer && (
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-sm text-gray-500">Designer</div>
                <div className="font-bold">{circuit.designer}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CircuitInfo;

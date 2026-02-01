
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Navigation } from "lucide-react";
import { getEventDetails, generateCalendarICS, downloadICSFile } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Event, Session } from "@/types";

// Mock event data
const MOCK_EVENT: Event = {
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
    address: "Via Senni 15, 50038 Scarperia e San Piero FI, Italy",
    lat: "43.9975",
    lng: "11.3719",
  },
  date_start: "2025-05-30T12:00:00.000Z",
  date_end: "2025-06-01T16:00:00.000Z",
  status: "scheduled"
};

// Mock sessions data
const MOCK_SESSIONS: Session[] = [
  {
    id: "session-1",
    type: "P1",
    date: "2025-05-30T10:45:00.000Z",
    number: 1,
    condition: {
      track: "Dry",
      air: "22°",
      humidity: "65%",
      ground: "32°",
      weather: "Sunny",
    },
    status: "Completed",
    category: {
      id: "cat-1",
      name: "MotoGP™",
      legacy_id: 3
    }
  },
  {
    id: "session-2",
    type: "P2",
    date: "2025-05-30T15:00:00.000Z",
    number: 2,
    condition: {
      track: "Dry",
      air: "25°",
      humidity: "58%",
      ground: "38°",
      weather: "Sunny",
    },
    status: "Completed",
    category: {
      id: "cat-1",
      name: "MotoGP™",
      legacy_id: 3
    }
  },
  {
    id: "session-3",
    type: "P3",
    date: "2025-05-31T10:00:00.000Z",
    number: 3,
    condition: {
      track: "Dry",
      air: "23°",
      humidity: "62%",
      ground: "30°",
      weather: "Partly Cloudy",
    },
    status: "Scheduled",
    category: {
      id: "cat-1",
      name: "MotoGP™",
      legacy_id: 3
    }
  },
  {
    id: "session-4",
    type: "Q1",
    date: "2025-05-31T13:10:00.000Z",
    number: 4,
    condition: {
      track: "Dry",
      air: "26°",
      humidity: "55%",
      ground: "36°",
      weather: "Cloudy",
    },
    status: "Scheduled",
    category: {
      id: "cat-1",
      name: "MotoGP™",
      legacy_id: 3
    }
  },
  {
    id: "session-5",
    type: "Q2",
    date: "2025-05-31T13:35:00.000Z",
    number: 5,
    condition: {
      track: "Dry",
      air: "26°",
      humidity: "55%",
      ground: "36°",
      weather: "Cloudy",
    },
    status: "Scheduled",
    category: {
      id: "cat-1",
      name: "MotoGP™",
      legacy_id: 3
    }
  },
  {
    id: "session-6",
    type: "RAC",
    date: "2025-06-01T13:00:00.000Z",
    number: 6,
    status: "Scheduled",
    category: {
      id: "cat-1",
      name: "MotoGP™",
      legacy_id: 3
    }
  }
];

const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("info");
  
  // Fetch event details
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEventDetails(id || ""),
    enabled: !!id,
  });
  
  // Show error notifications
  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading data",
        description: "Failed to load event details. Using mock data instead.",
        variant: "destructive",
      });
    }
  }, [error, toast]);
  
  // Use mock data if API call fails
  const eventData = event || MOCK_EVENT;

  const handleAddToCalendar = async () => {
    try {
      const calendarData = await generateCalendarICS(eventData.id);
      downloadICSFile(calendarData.ical, calendarData.eventName);
      
      toast({
        title: "Calendar file generated",
        description: "The event has been exported to a calendar file.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate calendar file.",
        variant: "destructive",
      });
    }
  };
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy");
  };
  
  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm");
  };
  
  const formatSessionType = (type: string) => {
    switch (type) {
      case 'P1': return 'Practice 1';
      case 'P2': return 'Practice 2';
      case 'P3': return 'Practice 3';
      case 'Q1': return 'Qualifying 1';
      case 'Q2': return 'Qualifying 2';
      case 'RAC': return 'Race';
      default: return type;
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-racing-red border-t-transparent rounded-full animate-spin"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-6">
          {/* Event Info Card */}
          <Card className="w-full lg:w-1/3">
            <CardHeader className="bg-racing-red text-white">
              <CardTitle className="text-2xl font-bold">{eventData.sponsored_name || eventData.name}</CardTitle>
              <div className="flex items-center text-sm">
                <Calendar size={16} className="mr-1" />
                <span>{formatDate(eventData.date_start)} - {formatDate(eventData.date_end)}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center font-medium text-lg mb-1">
                    <MapPin size={18} className="mr-2 text-racing-red" />
                    {eventData.circuit?.name}
                  </div>
                  <p className="text-gray-500 ml-6">{eventData.circuit?.city}, {eventData.country?.name}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium capitalize">{eventData.status}</p>
                </div>
                
                <div className="pt-2 space-x-2">
                  <Button onClick={handleAddToCalendar}>
                    Add to Calendar
                  </Button>
                  {eventData.circuit?.lat && eventData.circuit?.lng && (
                    <Button variant="outline">
                      <a 
                        href={`https://maps.google.com/?q=${eventData.circuit.lat},${eventData.circuit.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center"
                      >
                        <Navigation size={16} className="mr-2" />
                        Open in Maps
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Event Content */}
          <Card className="w-full lg:w-2/3">
            <CardHeader className="pb-2">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="info">Information</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="results">Results</TabsTrigger>
                  <TabsTrigger value="predictions">Predictions</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <TabsContent value="info" className="space-y-4">
                <div>
                  <h3 className="font-medium text-lg mb-2">Circuit Information</h3>
                  <div className="text-sm space-y-2">
                    <p><span className="font-medium">Length:</span> 5.245 km</p>
                    <p><span className="font-medium">Width:</span> 14 m</p>
                    <p><span className="font-medium">Left corners:</span> 6</p>
                    <p><span className="font-medium">Right corners:</span> 9</p>
                    <p><span className="font-medium">Longest straight:</span> 1.141 km</p>
                    <p><span className="font-medium">Track record:</span> 1:45.187 (Francesco Bagnaia, 2021)</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-lg mb-2">Weather Forecast</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-medium">Friday</p>
                      <p className="text-sm">Sunny, 25°C</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-medium">Saturday</p>
                      <p className="text-sm">Partly Cloudy, 24°C</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-medium">Sunday</p>
                      <p className="text-sm">Cloudy, 23°C</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="schedule">
                <div className="space-y-4">
                  <h3 className="font-medium text-lg mb-2">MotoGP™ Schedule</h3>
                  <div className="space-y-2">
                    {MOCK_SESSIONS.map(session => (
                      <div 
                        key={session.id} 
                        className={`p-3 rounded-lg border ${session.status === 'Completed' ? 'bg-gray-50' : 'bg-white'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{formatSessionType(session.type)}</p>
                            <div className="flex items-center text-sm text-gray-500">
                              <Calendar size={14} className="mr-1" />
                              <span>{formatDate(session.date)}</span>
                              <Clock size={14} className="ml-3 mr-1" />
                              <span>{formatTime(session.date)}</span>
                            </div>
                          </div>
                          <Badge className={
                            session.status === 'Completed' 
                              ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                          }>
                            {session.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-2">
                    <Link to="/live-timing">
                      <Button className="w-full bg-racing-red hover:bg-racing-red/90">
                        View Live Timing
                      </Button>
                    </Link>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="results">
                <div className="text-center py-8">
                  <p className="text-gray-500">Results will be available after the race.</p>
                </div>
              </TabsContent>
              
              <TabsContent value="predictions">
                <div className="text-center py-8">
                  <p className="text-gray-500">Predictions coming soon.</p>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle>Circuit Map</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {eventData.circuit?.lat && eventData.circuit?.lng ? (
              <iframe 
                title="Circuit Map"
                width="100%"
                height="400"
                frameBorder="0"
                src={`https://maps.google.com/maps?q=${eventData.circuit.lat},${eventData.circuit.lng}&z=15&output=embed`}
                allowFullScreen
              ></iframe>
            ) : (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-gray-500">Map not available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default EventDetail;

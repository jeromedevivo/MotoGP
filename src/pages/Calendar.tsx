
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSeason, getUpcomingEvents, getPastEvents, generateCalendarICS, downloadICSFile } from "@/lib/api";
import { Event } from "@/types";
import { Calendar as CalendarIcon, MapPin, Calendar as DateIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const CalendarPage: React.FC = () => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"upcoming" | "past">("upcoming");
  const [selectedYear, setSelectedYear] = useState<string>("");

  // Fetch current season
  const seasonQuery = useQuery({
    queryKey: ['current-season'],
    queryFn: getCurrentSeason
  });

  // Set selected year when current season loads
  useEffect(() => {
    if (seasonQuery.data?.id && !selectedYear) {
      setSelectedYear(seasonQuery.data.id);
    }
  }, [seasonQuery.data, selectedYear]);

  // Fetch events based on view mode
  const eventsQuery = useQuery({
    queryKey: ['events', selectedYear, viewMode],
    queryFn: () => viewMode === "upcoming" 
      ? getUpcomingEvents(selectedYear) 
      : getPastEvents(selectedYear),
    enabled: !!selectedYear,
  });

  // Handle calendar export
  const handleAddToCalendar = async (event: Event) => {
    try {
      const calendarData = await generateCalendarICS(event.id);
      downloadICSFile(calendarData.ical, calendarData.eventName);
      
      toast({
        title: "Calendar exported",
        description: "The event has been successfully exported to your calendar",
      });
    } catch (error) {
      console.error("Calendar export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export the event to calendar",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Race Calendar</h1>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <Button 
              variant={viewMode === "upcoming" ? "default" : "outline"}
              onClick={() => setViewMode("upcoming")}
            >
              Upcoming
            </Button>
            <Button 
              variant={viewMode === "past" ? "default" : "outline"}
              onClick={() => setViewMode("past")}
            >
              Past
            </Button>
          </div>
          
          <div className="w-full md:w-auto">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Select season" />
              </SelectTrigger>
              <SelectContent>
                {seasonQuery.data && (
                  <SelectItem value={seasonQuery.data.id} key={seasonQuery.data.id}>
                    {seasonQuery.data.year} Season {seasonQuery.data.current ? "(Current)" : ""}
                  </SelectItem>
                )}
                {/* Add more years here from API */}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {eventsQuery.isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-racing-red border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : eventsQuery.error ? (
          <div className="text-center p-8 border border-red-200 rounded-lg bg-red-50">
            <p className="text-red-600">Failed to load calendar data. Please try again later.</p>
            <Button onClick={() => eventsQuery.refetch()} className="mt-4">
              Retry
            </Button>
          </div>
        ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
          <div className="space-y-6">
            {eventsQuery.data.map((event: Event) => {
              const startDate = new Date(event.date_start);
              const endDate = new Date(event.date_end);
              
              return (
                <Card key={event.id} className="overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-4">
                    <div className="p-6 md:border-r">
                      <div className="flex flex-col items-center md:items-start">
                        <DateIcon size={24} className="mb-2 text-racing-red" />
                        <h3 className="text-xl font-bold mb-1">{format(startDate, "dd")}-{format(endDate, "dd")}</h3>
                        <p className="text-gray-500">{format(startDate, "MMMM yyyy")}</p>
                      </div>
                    </div>
                    
                    <div className="p-6 md:col-span-2">
                      <h2 className="text-xl font-bold mb-2">
                        {event.sponsored_name || event.name}
                      </h2>
                      
                      <div className="flex items-start space-x-2">
                        <MapPin size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">{event.circuit?.name}</p>
                          <p className="text-sm text-gray-500">
                            {event.circuit?.city && `${event.circuit.city}, `}{event.country?.name}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center">
                        <Badge className="capitalize">{event.status}</Badge>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-gray-50 flex flex-col justify-center space-y-3">
                      <Link to={`/events/${event.id}`}>
                        <Button className="w-full bg-racing-red hover:bg-racing-red/90">
                          View Details
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => handleAddToCalendar(event)}
                      >
                        <CalendarIcon size={16} className="mr-2" />
                        Add to Calendar
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center p-12 border border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-4">No {viewMode} races found for this season.</p>
            {viewMode === "upcoming" && (
              <Button onClick={() => setViewMode("past")}>
                View Past Races
              </Button>
            )}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default CalendarPage;

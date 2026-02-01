
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getCurrentSeason, getCategories, getEvents, getPredictions } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Category, Event, Prediction } from "@/types";
import { useToast } from "@/components/ui/use-toast";

const PredictionsPage: React.FC = () => {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  
  // Fetch current season
  const seasonQuery = useQuery({
    queryKey: ['current-season'],
    queryFn: getCurrentSeason
  });
  
  // Fetch categories
  const categoriesQuery = useQuery({
    queryKey: ['categories', seasonQuery.data?.id],
    queryFn: () => getCategories(seasonQuery.data?.id || ""),
    enabled: !!seasonQuery.data?.id
  });
  
  // Fetch upcoming events
  const eventsQuery = useQuery({
    queryKey: ['upcoming-events', seasonQuery.data?.id],
    queryFn: () => getEvents(seasonQuery.data?.id || "", false),
    enabled: !!seasonQuery.data?.id
  });
  
  // Fetch predictions
  const predictionsQuery = useQuery({
    queryKey: ['predictions', selectedEvent, selectedCategory],
    queryFn: () => getPredictions(selectedEvent, selectedCategory),
    enabled: !!(selectedEvent && selectedCategory),
    staleTime: 30 * 1000 // 30 seconds
  });
  
  // Initialize selected values when data is loaded
  useEffect(() => {
    if (categoriesQuery.data && categoriesQuery.data.length > 0 && !selectedCategory) {
      // Default to MotoGP category if available
      const motogpCategory = categoriesQuery.data.find(cat => 
        cat.name.toLowerCase().includes('motogp')
      );
      
      if (motogpCategory) {
        setSelectedCategory(motogpCategory.id);
      } else {
        setSelectedCategory(categoriesQuery.data[0].id);
      }
    }
  }, [categoriesQuery.data, selectedCategory]);
  
  useEffect(() => {
    if (eventsQuery.data && eventsQuery.data.length > 0 && !selectedEvent) {
      setSelectedEvent(eventsQuery.data[0].id);
    }
  }, [eventsQuery.data, selectedEvent]);
  
  // Show error notifications
  useEffect(() => {
    if (seasonQuery.error) {
      toast({
        title: "Error loading data",
        description: "Failed to load season data. Please try again later.",
        variant: "destructive",
      });
    }
  }, [seasonQuery.error, toast]);
  
  const getFormIcon = (form?: string) => {
    if (!form) return <Minus className="text-gray-400" />;
    
    switch (form) {
      case "ascending":
        return <TrendingUp className="text-green-500" />;
      case "descending":
        return <TrendingDown className="text-red-500" />;
      default:
        return <Minus className="text-gray-400" />;
    }
  };
  
  const getSelectedEventName = () => {
    if (!selectedEvent || !eventsQuery.data) return "Upcoming Event";
    const event = eventsQuery.data.find(e => e.id === selectedEvent);
    return event?.sponsored_name || event?.name || "Upcoming Event";
  };
  
  const isLoading = seasonQuery.isLoading || 
    categoriesQuery.isLoading || 
    eventsQuery.isLoading ||
    (predictionsQuery.isLoading && selectedEvent && selectedCategory);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Race Predictions</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>AI Race Winner Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 border-4 border-t-racing-red rounded-full animate-spin"></div>
                  <p className="mt-4 text-gray-500">Loading predictions...</p>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="w-full md:w-1/2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <Select 
                        value={selectedCategory} 
                        onValueChange={setSelectedCategory}
                        disabled={categoriesQuery.isLoading || !categoriesQuery.data}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriesQuery.data?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full md:w-1/2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
                      <Select 
                        value={selectedEvent} 
                        onValueChange={setSelectedEvent}
                        disabled={eventsQuery.isLoading || !eventsQuery.data || eventsQuery.data.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                        <SelectContent>
                          {eventsQuery.data?.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              {event.sponsored_name || event.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {predictionsQuery.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                      <AlertCircle className="text-red-500 mr-3 mt-0.5" size={18} />
                      <div>
                        <h4 className="font-medium text-red-800">Failed to load predictions</h4>
                        <p className="text-sm text-red-600">
                          There was an error generating predictions. Please try again later.
                        </p>
                      </div>
                    </div>
                  ) : predictionsQuery.data && predictionsQuery.data.length > 0 ? (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold">
                        Predictions for {getSelectedEventName()}
                      </h3>
                      
                      {predictionsQuery.data.map((prediction, index) => (
                        <div key={index} className="border border-border rounded-lg p-4 bg-white">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                              <Badge 
                                className={index === 0 ? "bg-yellow-400 text-black" : "bg-gray-200 text-gray-800"}
                              >
                                #{index + 1}
                              </Badge>
                              <span className="font-bold text-lg">
                                {prediction.rider.full_name}
                              </span>
                              {prediction.rider.number && (
                                <Badge variant="outline" className="font-mono">
                                  {prediction.rider.number}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {getFormIcon(prediction.form)}
                              <span 
                                className={`font-semibold ${
                                  prediction.form === "ascending" ? "text-green-600" : 
                                  prediction.form === "descending" ? "text-red-600" : 
                                  "text-gray-600"
                                }`}
                              >
                                {(prediction.probability * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <Progress value={prediction.probability * 100} className="h-2" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 border border-border rounded-md">
                      <p className="text-gray-500">
                        {selectedEvent && selectedCategory
                          ? "No predictions available for the selected event and category."
                          : "Select a category and event to see predictions."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <p>
                  Our AI prediction model analyzes multiple factors to predict race outcomes:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Historical performance at similar circuits</li>
                  <li>Recent form and momentum</li>
                  <li>Qualifying positions</li>
                  <li>Weather conditions and adaptability</li>
                  <li>Team performance and bike development</li>
                </ul>
                <p className="pt-2 text-gray-600">
                  Predictions are updated regularly as new data becomes available.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Understanding Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-3">
                  <TrendingUp className="text-green-500 mr-2" />
                  <h3 className="font-medium">Ascending Form</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Rider showing improvement in recent races with better than expected results.
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-3">
                  <Minus className="text-gray-400 mr-2" />
                  <h3 className="font-medium">Stable Form</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Consistent performance in line with expectations based on previous results.
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-3">
                  <TrendingDown className="text-red-500 mr-2" />
                  <h3 className="font-medium">Descending Form</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Recent results below typical performance levels, may be struggling with setup or injury.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default PredictionsPage;


import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { getLiveTiming } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mock live timing data
const MOCK_LIVE_TIMING = {
  head: {
    championship_id: "3",
    category: "MotoGP",
    circuit_id: "6",
    circuit_name: "Autodromo Internazionale del Mugello",
    event_id: "606",
    event_tv_name: "Gran Premio d'Italia Oakley",
    event_shortname: "ITA",
    date: "03/06/2025",
    num_laps: 23,
    session_id: "1",
    session_type: 4,
    session_name: "Race",
    session_shortname: "RAC",
    duration: "0",
    remaining: "0",
    session_status_id: "A",
    session_status_name: "Active",
  },
  rider: {
    "1": {
      order: 1,
      rider_id: 8273,
      status_name: "CL",
      status_id: "1",
      rider_number: "1",
      color: "#c80000",
      text_color: "#ffffff",
      pos: 1,
      rider_shortname: "Bagnaia",
      rider_name: "Francesco",
      rider_surname: "BAGNAIA",
      lap_time: "1'46.345",
      num_lap: 5,
      last_lap_time: "1'46.789",
      last_lap: 4,
      trac_status: "A",
      team_name: "Ducati Lenovo Team",
      bike_name: "Ducati",
      gap_first: "0.000",
      gap_prev: "0.000",
      on_pit: false
    },
    "2": {
      order: 2,
      rider_id: 8150,
      status_name: "CL",
      status_id: "1",
      rider_number: "93",
      color: "#a80000",
      text_color: "#ffffff",
      pos: 2,
      rider_shortname: "Marquez",
      rider_name: "Marc",
      rider_surname: "MARQUEZ",
      lap_time: "1'46.512",
      num_lap: 5,
      last_lap_time: "1'46.901",
      last_lap: 4,
      trac_status: "A",
      team_name: "Gresini Racing MotoGP",
      bike_name: "Ducati",
      gap_first: "+0.167",
      gap_prev: "+0.167",
      on_pit: false
    },
    "3": {
      order: 3,
      rider_id: 7444,
      status_name: "CL",
      status_id: "1",
      rider_number: "89",
      color: "#d20000",
      text_color: "#ffffff",
      pos: 3,
      rider_shortname: "Martin",
      rider_name: "Jorge",
      rider_surname: "MARTIN",
      lap_time: "1'46.623",
      num_lap: 5,
      last_lap_time: "1'47.012",
      last_lap: 4,
      trac_status: "A",
      team_name: "Prima Pramac Racing",
      bike_name: "Ducati",
      gap_first: "+0.278",
      gap_prev: "+0.111",
      on_pit: false
    },
    "4": {
      order: 4,
      rider_id: 8273,
      status_name: "CL",
      status_id: "1",
      rider_number: "23",
      color: "#c80000",
      text_color: "#ffffff",
      pos: 4,
      rider_shortname: "Bastianini",
      rider_name: "Enea",
      rider_surname: "BASTIANINI",
      lap_time: "1'46.789",
      num_lap: 5,
      last_lap_time: "1'47.104",
      last_lap: 4,
      trac_status: "A",
      team_name: "Ducati Lenovo Team",
      bike_name: "Ducati",
      gap_first: "+0.444",
      gap_prev: "+0.166",
      on_pit: false
    },
    "5": {
      order: 5,
      rider_id: 7646,
      status_name: "CL",
      status_id: "1",
      rider_number: "33",
      color: "#ff6600",
      text_color: "#ffffff",
      pos: 5,
      rider_shortname: "Binder",
      rider_name: "Brad",
      rider_surname: "BINDER",
      lap_time: "1'46.911",
      num_lap: 5,
      last_lap_time: "1'47.231",
      last_lap: 4,
      trac_status: "A",
      team_name: "Red Bull KTM Factory Racing",
      bike_name: "KTM",
      gap_first: "+0.566",
      gap_prev: "+0.122",
      on_pit: false
    }
  }
};

// Convert the object to array for easier rendering
const convertRiderObjectToArray = (riderObj: any) => {
  return Object.entries(riderObj).map(([key, value]) => ({
    id: key,
    ...value as any
  }));
};

const LiveTiming: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("timing");
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  
  // Fetch live timing data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['live-timing'],
    queryFn: getLiveTiming,
    refetchInterval: isAutoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: false,
  });
  
  // Show error notifications
  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading data",
        description: "Failed to load live timing data. Using mock data instead.",
        variant: "destructive",
      });
    }
  }, [error, toast]);
  
  // Use mock data if API call fails
  const timingData = data || MOCK_LIVE_TIMING;
  const riders = convertRiderObjectToArray(timingData.rider);
  
  const handleManualRefresh = () => {
    refetch();
    toast({
      title: "Refreshing data",
      description: "Updating live timing information...",
    });
  };
  
  const toggleAutoRefresh = () => {
    setIsAutoRefresh(prev => !prev);
    toast({
      title: isAutoRefresh ? "Auto refresh disabled" : "Auto refresh enabled",
      description: isAutoRefresh 
        ? "You will need to manually refresh the data." 
        : `Data will automatically refresh every ${refreshInterval / 1000} seconds.`,
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Live Timing</h1>
          <div className="flex space-x-2">
            <Button onClick={handleManualRefresh} disabled={isLoading}>
              Refresh
            </Button>
            <Button 
              variant={isAutoRefresh ? "default" : "outline"}
              onClick={toggleAutoRefresh}
            >
              {isAutoRefresh ? "Auto" : "Manual"}
            </Button>
          </div>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="bg-racing-red text-white">
            <CardTitle className="text-xl flex justify-between">
              <span>{timingData.head.event_tv_name}</span>
              <Badge variant="secondary">
                {timingData.head.session_name}
              </Badge>
            </CardTitle>
            <p className="text-sm">{timingData.head.circuit_name}</p>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b">
                <TabsList className="w-full h-auto p-0 bg-transparent">
                  <TabsTrigger 
                    value="timing" 
                    className="flex-1 py-3 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-racing-red"
                  >
                    Timing
                  </TabsTrigger>
                  <TabsTrigger 
                    value="classification" 
                    className="flex-1 py-3 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-racing-red"
                  >
                    Classification
                  </TabsTrigger>
                  <TabsTrigger 
                    value="analysis" 
                    className="flex-1 py-3 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-racing-red"
                  >
                    Analysis
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="timing" className="m-0">
                <ScrollArea className="h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pos</TableHead>
                        <TableHead>No.</TableHead>
                        <TableHead>Rider</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Last Lap</TableHead>
                        <TableHead>Best Lap</TableHead>
                        <TableHead>Gap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riders.map(rider => (
                        <TableRow key={rider.id} className={rider.on_pit ? "bg-gray-100" : ""}>
                          <TableCell>{rider.pos}</TableCell>
                          <TableCell>
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center" 
                              style={{backgroundColor: rider.color, color: rider.text_color}}
                            >
                              {rider.rider_number}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{rider.rider_name} {rider.rider_surname}</span>
                              <p className="text-xs text-gray-500">{rider.bike_name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">{rider.team_name}</TableCell>
                          <TableCell>{rider.last_lap_time}</TableCell>
                          <TableCell className="font-medium">{rider.lap_time}</TableCell>
                          <TableCell>{rider.gap_first}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="classification" className="m-0">
                <div className="p-6 text-center">
                  <p className="text-gray-500">Classification data will be available soon.</p>
                </div>
              </TabsContent>
              
              <TabsContent value="analysis" className="m-0">
                <div className="p-6 text-center">
                  <p className="text-gray-500">Analysis data will be available soon.</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium">
                  <Badge className={
                    timingData.head.session_status_name === 'Active' 
                      ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                      : 'bg-red-100 text-red-800 hover:bg-red-100'
                  }>
                    {timingData.head.session_status_name}
                  </Badge>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Laps</p>
                <p className="font-medium">{timingData.head.num_laps}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Session</p>
                <p className="font-medium">{timingData.head.session_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">{timingData.head.date}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default LiveTiming;

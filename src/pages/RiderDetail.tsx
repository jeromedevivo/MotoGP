
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRiderDetails } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Rider } from "@/types";

// Mock rider data
const MOCK_RIDER: Rider = {
  id: "rider-1",
  full_name: "Francesco Bagnaia",
  name: "Francesco",
  surname: "Bagnaia",
  number: 1,
  country: {
    iso: "IT",
    name: "Italy",
  },
  team: {
    id: "team-1",
    name: "Ducati Lenovo Team",
    constructor: {
      id: "const-1",
      name: "Ducati",
      legacy_id: 110
    }
  },
  constructor: {
    id: "const-1",
    name: "Ducati",
    legacy_id: 110
  },
  position: 1,
  points: 387
};

const RiderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("stats");

  // Fetch rider details
  const { data: rider, isLoading, error } = useQuery({
    queryKey: ['rider', id],
    queryFn: () => getRiderDetails(id || ""),
    enabled: !!id,
  });

  // Show error notifications
  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading data",
        description: "Failed to load rider details. Using mock data instead.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Use mock data if API call fails
  const riderData = rider || MOCK_RIDER;

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
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6">
          {/* Rider Profile Card */}
          <Card className="w-full md:w-1/3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold">{riderData.full_name}</CardTitle>
                  <p className="text-gray-500">{riderData.country?.name}</p>
                </div>
                {riderData.number && (
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-racing-red text-white text-2xl font-bold">
                    {riderData.number}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Team</p>
                  <p className="font-medium">{riderData.team?.name || "N/A"}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Constructor</p>
                  <p className="font-medium">{riderData.constructor?.name || "N/A"}</p>
                </div>
                
                {riderData.position && (
                  <div>
                    <p className="text-sm text-gray-500">Current Position</p>
                    <div className="flex items-center">
                      <Badge className="bg-racing-red">{riderData.position}</Badge>
                      {riderData.points && <span className="ml-2 font-medium">{riderData.points} pts</span>}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Rider Stats and Content */}
          <Card className="w-full md:w-2/3">
            <CardHeader className="pb-2">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="stats">Statistics</TabsTrigger>
                  <TabsTrigger value="results">Recent Results</TabsTrigger>
                  <TabsTrigger value="career">Career</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <TabsContent value="stats" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-3xl font-bold text-racing-red">26</p>
                    <p className="text-sm text-gray-500">Grand Prix Wins</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-3xl font-bold text-racing-red">75</p>
                    <p className="text-sm text-gray-500">Podiums</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-3xl font-bold text-racing-red">15</p>
                    <p className="text-sm text-gray-500">Pole Positions</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-3xl font-bold text-racing-red">1</p>
                    <p className="text-sm text-gray-500">World Titles</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Stats by Class</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Seasons</TableHead>
                        <TableHead>Races</TableHead>
                        <TableHead>Wins</TableHead>
                        <TableHead>Podiums</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>MotoGP™</TableCell>
                        <TableCell>6</TableCell>
                        <TableCell>167</TableCell>
                        <TableCell>10</TableCell>
                        <TableCell>35</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Moto2™</TableCell>
                        <TableCell>3</TableCell>
                        <TableCell>36</TableCell>
                        <TableCell>8</TableCell>
                        <TableCell>16</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Moto3™</TableCell>
                        <TableCell>4</TableCell>
                        <TableCell>32</TableCell>
                        <TableCell>8</TableCell>
                        <TableCell>24</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="results">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Grand Prix</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>14/04/2024</TableCell>
                      <TableCell>Americas GP</TableCell>
                      <TableCell>1</TableCell>
                      <TableCell>25</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>31/03/2024</TableCell>
                      <TableCell>Argentina GP</TableCell>
                      <TableCell>2</TableCell>
                      <TableCell>20</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>24/03/2024</TableCell>
                      <TableCell>Portugal GP</TableCell>
                      <TableCell>1</TableCell>
                      <TableCell>25</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>10/03/2024</TableCell>
                      <TableCell>Qatar GP</TableCell>
                      <TableCell>3</TableCell>
                      <TableCell>16</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>
              
              <TabsContent value="career">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-2">Career Highlights</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>2023: MotoGP™ World Champion</li>
                      <li>2022: MotoGP™ World Champion</li>
                      <li>2018: Moto2™ World Championship runner-up</li>
                      <li>2016: First Grand Prix victory at Qatar (Moto3™)</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Teams</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Years</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Category</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>2021-Present</TableCell>
                          <TableCell>Ducati Lenovo Team</TableCell>
                          <TableCell>MotoGP™</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>2019-2020</TableCell>
                          <TableCell>Pramac Racing</TableCell>
                          <TableCell>MotoGP™</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>2017-2018</TableCell>
                          <TableCell>SKY Racing Team VR46</TableCell>
                          <TableCell>Moto2™</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle>Season Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-gray-500">Performance chart coming soon</p>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default RiderDetail;

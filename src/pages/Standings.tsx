import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Category, RiderStanding } from "@/types";
import { getCurrentSeason, getCategories, getRiderStandings, getConstructorStandings, getTeamStandings } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const StandingsPage: React.FC = () => {
  const { toast } = useToast();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

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

  // Set default category when categories are loaded
  useEffect(() => {
    if (categoriesQuery.data && categoriesQuery.data.length > 0 && !selectedCategoryId) {
      // Default to MotoGP category if available
      const motogpCategory = categoriesQuery.data.find(cat =>
          cat.name.toLowerCase().includes('motogp')
      );

      if (motogpCategory) {
        setSelectedCategoryId(motogpCategory.id);
      } else {
        setSelectedCategoryId(categoriesQuery.data[0].id);
      }
    }
  }, [categoriesQuery.data, selectedCategoryId]);

  // Fetch rider standings
  const standingsQuery = useQuery({
    queryKey: ['standings', seasonQuery.data?.id, selectedCategoryId],
    queryFn: () => getRiderStandings(seasonQuery.data?.id || "", selectedCategoryId),
    enabled: !!(seasonQuery.data?.id && selectedCategoryId),
  });

  // Fetch constructor standings
  const constructorStandingsQuery = useQuery({
    queryKey: ['constructor-standings', seasonQuery.data?.id, selectedCategoryId],
    queryFn: () => getConstructorStandings(seasonQuery.data?.id || "", selectedCategoryId),
    enabled: !!(seasonQuery.data?.id && selectedCategoryId),
  });

  // Fetch team standings
  const teamStandingsQuery = useQuery({
    queryKey: ['team-standings', seasonQuery.data?.id, selectedCategoryId],
    queryFn: async () => {
      const data = await getTeamStandings(seasonQuery.data?.id || "", selectedCategoryId);

      // Process team standings to merge duplicate teams
      const teamMap = new Map();

      // Group by team name and sum points
      data.forEach((team: any) => {
        const key = team.team_name;
        if (!teamMap.has(key)) {
          teamMap.set(key, {
            ...team,
            original_points: team.points,
            points: team.points
          });
        } else {
          // Add points to existing team
          const existingTeam = teamMap.get(key);
          existingTeam.points += team.points;
          existingTeam.original_points = `${existingTeam.original_points} + ${team.points}`;
        }
      });

      // Convert back to array and re-sort by points
      const mergedTeams = Array.from(teamMap.values())
          .sort((a, b) => b.points - a.points)
          .map((team, index) => ({
            ...team,
            id: `team-${index + 1}`,
            position: index + 1
          }));

      return mergedTeams;
    },
    enabled: !!(seasonQuery.data?.id && selectedCategoryId),
  });

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

  const getPositionBadgeClass = (position: number) => {
    switch (position) {
      case 1:
        return "bg-yellow-400 text-black";
      case 2:
        return "bg-gray-300 text-black";
      case 3:
        return "bg-amber-700 text-white";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const isLoading = seasonQuery.isLoading || categoriesQuery.isLoading ||
      (standingsQuery.isLoading && !!selectedCategoryId && !!seasonQuery.data?.id);

  const isConstructorLoading = constructorStandingsQuery.isLoading &&
      !!selectedCategoryId && !!seasonQuery.data?.id;

  const isTeamLoading = teamStandingsQuery.isLoading &&
      !!selectedCategoryId && !!seasonQuery.data?.id;

  return (
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-6">Championship Standings</h1>

          <Card className="mb-8">
            <CardHeader className="pb-2">
              <CardTitle>{seasonQuery.data?.year || ""} Season Standings</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <TabsList className="mb-4">
                  {categoriesQuery.data?.map((category) => (
                      <TabsTrigger key={category.id} value={category.id}>
                        {category.name}
                      </TabsTrigger>
                  ))}
                </TabsList>

                {categoriesQuery.data?.map((category) => (
                    <TabsContent key={category.id} value={category.id}>
                      {isLoading ? (
                          <div className="flex justify-center items-center py-12">
                            <div className="w-12 h-12 border-4 border-racing-red border-t-transparent rounded-full animate-spin"></div>
                          </div>
                      ) : standingsQuery.error ? (
                          <div className="text-center text-red-600 py-8">
                            <p>Failed to load standings data. Please try again later.</p>
                          </div>
                      ) : standingsQuery.data && standingsQuery.data.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">Pos</TableHead>
                                  <TableHead>Rider</TableHead>
                                  <TableHead className="hidden md:table-cell">Team</TableHead>
                                  <TableHead className="hidden md:table-cell">Constructor</TableHead>
                                  <TableHead className="text-right">Points</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {standingsQuery.data.map((standing: RiderStanding) => (
                                    <TableRow key={standing.id}>
                                      <TableCell>
                                        <Badge className={getPositionBadgeClass(standing.position)}>
                                          {standing.position}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {standing.rider.full_name}
                                        <div className="text-xs text-gray-500 md:hidden">
                                          {standing.team?.name}
                                        </div>
                                      </TableCell>
                                      <TableCell className="hidden md:table-cell">{standing.team?.name}</TableCell>
                                      <TableCell className="hidden md:table-cell">{standing.constructor?.name}</TableCell>
                                      <TableCell className="text-right font-bold">
                                        {standing.points}
                                      </TableCell>
                                    </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                      ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500">
                              {category.name} standings coming soon
                            </p>
                          </div>
                      )}
                    </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Constructor Standings</CardTitle>
              </CardHeader>
              <CardContent>
                {isConstructorLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="w-12 h-12 border-4 border-racing-red border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : constructorStandingsQuery.error ? (
                    <div className="text-center text-red-600 py-8">
                      <p>Failed to load constructor standings data.</p>
                    </div>
                ) : constructorStandingsQuery.data && constructorStandingsQuery.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Pos</TableHead>
                            <TableHead>Constructor</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {constructorStandingsQuery.data.map((standing: any) => (
                              <TableRow key={standing.id}>
                                <TableCell>
                                  <Badge className={getPositionBadgeClass(standing.position)}>
                                    {standing.position}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{standing.constructor_name}</TableCell>
                                <TableCell className="text-right font-bold">{standing.points}</TableCell>
                              </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Constructor standings coming soon</p>
                    </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Standings</CardTitle>
              </CardHeader>
              <CardContent>
                {isTeamLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="w-12 h-12 border-4 border-racing-red border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : teamStandingsQuery.error ? (
                    <div className="text-center text-red-600 py-8">
                      <p>Failed to load team standings data.</p>
                    </div>
                ) : teamStandingsQuery.data && teamStandingsQuery.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Pos</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamStandingsQuery.data.map((standing: any) => (
                              <TableRow key={standing.id}>
                                <TableCell>
                                  <Badge className={getPositionBadgeClass(standing.position)}>
                                    {standing.position}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {standing.team_name}
                                  <div className="text-xs text-gray-500">
                                    {standing.constructor_name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-bold">{standing.points}</TableCell>
                              </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Team standings coming soon</p>
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
  );
};

export default StandingsPage;
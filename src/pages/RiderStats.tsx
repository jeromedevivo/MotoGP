import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getRiderDetails, getAllRiders } from "@/lib/api";
import { Rider, RiderSeasonStatistic } from "@/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

const RiderStats: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [rider, setRider] = useState<Rider | null>(null);
  const [allRiders, setAllRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRiderData = async () => {
      if (!id) {
        setError("Invalid rider ID");
        setLoading(false);
        return;
      }

      try {
        // Fetch the specific rider details
        const riderData = await getRiderDetails(id);
        setRider(riderData);

        // Fetch all riders for comparison purposes
        const allRidersData = await getAllRiders();
        setAllRiders(allRidersData);
      } catch (err) {
        console.error("Error fetching rider data:", err);
        setError("Failed to load rider details");
      } finally {
        setLoading(false);
      }
    };

    fetchRiderData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-racing-red"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !rider) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">Error</h2>
                <p className="text-muted-foreground">{error || "Rider not found"}</p>
                <Button asChild className="mt-4">
                  <Link to="/riders">Back to Riders</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Prepare data for charts
  const prepareChartData = (stats: RiderSeasonStatistic[]) => {
    return stats.map(stat => ({
      season: stat.season,
      points: stat.points,
      position: stat.position,
      podiums: stat.podiums,
      starts: stat.starts
    })).sort((a, b) => parseInt(a.season) - parseInt(b.season));
  };

  const chartData = rider.statistics ? prepareChartData(rider.statistics) : [];

  // Find rider's current team
  const currentTeam = rider.current_career_step?.team || rider.team;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Rider Header */}
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/riders">← Back to Riders</Link>
          </Button>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex-shrink-0">
                  {rider.picture ? (
                    <img
                      src={rider.picture}
                      alt={rider.full_name}
                      className="w-32 h-32 rounded-full object-cover border-4 border-racing-red"
                    />
                  ) : (
                    <div className="bg-muted border-2 border-dashed rounded-xl w-32 h-32 flex items-center justify-center">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}
                </div>

                <div className="flex-grow">
                  <h1 className="text-3xl font-bold text-foreground mb-2">{rider.full_name}</h1>

                  {rider.nickname && (
                    <p className="text-lg text-muted-foreground mb-2">"{rider.nickname}"</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    {rider.country && (
                      <Badge variant="secondary" className="flex items-center">
                        <img
                          src={rider.country.flag}
                          alt={rider.country.name}
                          className="w-4 h-4 mr-1"
                        />
                        {rider.country.name}
                      </Badge>
                    )}

                    {currentTeam && (
                      <Badge variant="outline" className="flex items-center">
                        <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: currentTeam.color }}></span>
                        {currentTeam.name}
                      </Badge>
                    )}

                    {rider.constructor && (
                      <Badge variant="outline">{rider.constructor.name}</Badge>
                    )}

                    {rider.number && (
                      <Badge variant="default">#{rider.number}</Badge>
                    )}
                  </div>

                  {rider.physical_attributes && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Height</p>
                        <p className="font-medium">{rider.physical_attributes.height} cm</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Weight</p>
                        <p className="font-medium">{rider.physical_attributes.weight} kg</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Age</p>
                        <p className="font-medium">{rider.years_old} years</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Season Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-racing-red">{rider.statistics?.length || 0}</p>
              <p className="text-muted-foreground">Seasons Competed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Points</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-racing-red">
                {rider.statistics?.reduce((sum, stat) => sum + stat.points, 0) || 0}
              </p>
              <p className="text-muted-foreground">Total Points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Podiums</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-racing-red">
                {rider.statistics?.reduce((sum, stat) => sum + stat.podiums, 0) || 0}
              </p>
              <p className="text-muted-foreground">Total Podiums</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Points Over Seasons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="season" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="points" stroke="#ef4444" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Position Over Seasons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="season" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="position" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Statistics Table */}
        {rider.statistics && rider.statistics.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Detailed Season Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Season</TableHead>
                    <TableHead>Constructor</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Podiums</TableHead>
                    <TableHead>Poles</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rider.statistics.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{stat.season}</TableCell>
                      <TableCell>{stat.constructor}</TableCell>
                      <TableCell>{stat.starts}</TableCell>
                      <TableCell>{stat.podiums}</TableCell>
                      <TableCell>{stat.poles}</TableCell>
                      <TableCell className="font-bold text-racing-red">{stat.points}</TableCell>
                      <TableCell>
                        <Badge variant={stat.position === 1 ? "default" : "secondary"}>
                          {stat.position}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Comparison Section */}
        <Card>
          <CardHeader>
            <CardTitle>Rider Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Compare {rider.full_name} with other riders:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allRiders
                .filter(r => r.id !== id && r.full_name)
                .slice(0, 6)
                .map(otherRider => (
                  <Button
                    key={otherRider.id}
                    asChild
                    variant="outline"
                    className="justify-start"
                  >
                    <Link to={`/riders/${otherRider.id}/stats`}>
                      {otherRider.full_name}
                      {otherRider.team && (
                        <span className="text-sm text-muted-foreground ml-2">({otherRider.team.name})</span>
                      )}
                    </Link>
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default RiderStats;
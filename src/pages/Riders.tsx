import React, { useState, useEffect } from "react";
import { Rider, Category } from "@/types";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCurrentSeason, getCategories, getAllRiders } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const RidersPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const season = await getCurrentSeason();
        const categoriesData = await getCategories(season.id);
        setCategories(categoriesData);

        if (categoriesData.length > 0) {
          setSelectedCategory(categoriesData[0].id);
        }

        const ridersData = await getAllRiders();
        setRiders(ridersData);
      } catch (err) {
        console.error("Failed to fetch riders data:", err);
        setError("Failed to load riders data. Please try again later.");
        toast({
          title: "Error",
          description: "Failed to load riders data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const getFilteredRiders = () => {
    if (!selectedCategory) return [];
    return riders.filter(rider =>
        rider.constructor?.name.toLowerCase().includes(selectedCategory.toLowerCase())
    );
  };

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

  return (
      <div className="bg-white rounded-lg border border-border p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Riders</h2>
          <Link to="/riders">
            <Button variant="ghost" size="sm" className="text-racing-red flex items-center">
              View All <ChevronRight size={14} className="ml-1" />
            </Button>
          </Link>
        </div>

        {loading && categories.length === 0 ? (
            <div className="text-center py-8">Loading categories...</div>
        ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
        ) : categories.length > 0 ? (
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
              <TabsList className="mb-4">
                {categories.map((category) => (
                    <TabsTrigger key={category.id} value={category.id}>
                      {category.name}
                    </TabsTrigger>
                ))}
              </TabsList>

              {categories.map((category) => (
                  <TabsContent key={category.id} value={category.id}>
                    <ScrollArea className="h-[400px]">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">No</TableHead>
                              <TableHead>Rider</TableHead>
                              <TableHead className="hidden md:table-cell">Team</TableHead>
                              <TableHead className="text-right">Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loading && selectedCategory === category.id ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-4">
                                    Loading riders...
                                  </TableCell>
                                </TableRow>
                            ) : selectedCategory === category.id && getFilteredRiders().length > 0 ? (
                                getFilteredRiders().map((rider) => (
                                    <TableRow key={rider.id}>
                                      <TableCell>
                                        <Badge className="bg-gray-100 text-gray-700">
                                          {rider.number}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        <Link to={`/riders/${rider.id}`} className="hover:text-racing-red">
                                          {rider.full_name}
                                          <div className="text-xs text-gray-500">
                                            {rider.country?.name}
                                          </div>
                                        </Link>
                                      </TableCell>
                                      <TableCell className="hidden md:table-cell">{rider.team?.name}</TableCell>
                                      <TableCell className="text-right font-bold">
                                        {rider.points || 0}
                                      </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-4">
                                    No riders available for {category.name}
                                  </TableCell>
                                </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  </TabsContent>
              ))}
            </Tabs>
        ) : (
            <div className="text-center py-8">No categories available</div>
        )}
      </div>
  );
};

export default RidersPage;
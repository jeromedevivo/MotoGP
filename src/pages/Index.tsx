
import React from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import UpcomingRaces from "@/components/UpcomingRaces";
import RiderStandings from "@/components/RiderStandings";
import CircuitInfo from "@/components/CircuitInfo";
import PredictionWidget from "@/components/PredictionWidget";
import { Button } from "@/components/ui/button";

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <UpcomingRaces />
        
        <h2 className="text-2xl font-bold mb-4">Race Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="col-span-1 md:col-span-2">
            <RiderStandings />
          </div>
          <div className="col-span-1 space-y-6">
            <PredictionWidget />
            <CircuitInfo />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-border mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">About Race Insights Forecaster</h2>
            <div className="space-x-3">
              <Link to="/calendar">
                <Button variant="outline" size="sm" className="text-racing-red">
                  View Calendar
                </Button>
              </Link>
              <Link to="/riders">
                <Button variant="outline" size="sm" className="text-racing-red">
                  View Riders
                </Button>
              </Link>
            </div>
          </div>
          <p className="text-gray-700 mb-4">
            Welcome to the Race Insights Forecaster, your ultimate companion for MotoGP races. 
            Our platform provides comprehensive information about upcoming races, rider standings, 
            circuit details, and race predictions.
          </p>
          <p className="text-gray-700">
            Stay tuned for more features including live timing, detailed statistics, 
            historical race data, and calendar integration with Google Calendar and Apple Calendar.
          </p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;

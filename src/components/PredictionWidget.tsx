
import React from "react";
import { Rider } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";

// Mock prediction data
const MOCK_PREDICTIONS = [
  {
    rider: {
      id: "rider-1",
      full_name: "Francesco Bagnaia",
      number: 1,
      constructor: {
        id: "const-1",
        name: "Ducati",
        legacy_id: 110
      },
      form: "ascending",
      position: 1
    } as Rider,
    probability: 0.85,
    form: "ascending" as const
  },
  {
    rider: {
      id: "rider-3",
      full_name: "Marc Marquez",
      number: 93,
      constructor: {
        id: "const-1",
        name: "Ducati",
        legacy_id: 110
      },
      form: "ascending",
      position: 3
    } as Rider,
    probability: 0.75,
    form: "ascending" as const
  },
  {
    rider: {
      id: "rider-2",
      full_name: "Jorge Martin",
      number: 89,
      constructor: {
        id: "const-1",
        name: "Ducati",
        legacy_id: 110
      },
      form: "stable",
      position: 2
    } as Rider,
    probability: 0.70,
    form: "stable" as const
  },
  {
    rider: {
      id: "rider-5",
      full_name: "Brad Binder",
      number: 33,
      constructor: {
        id: "const-2",
        name: "KTM",
        legacy_id: 111
      },
      form: "ascending",
      position: 5
    } as Rider,
    probability: 0.60,
    form: "ascending" as const
  },
  {
    rider: {
      id: "rider-4",
      full_name: "Enea Bastianini",
      number: 23,
      constructor: {
        id: "const-1",
        name: "Ducati",
        legacy_id: 110
      },
      form: "descending",
      position: 4
    } as Rider,
    probability: 0.55,
    form: "descending" as const
  }
];

const PredictionWidget = () => {
  const getFormIcon = (form: string) => {
    switch (form) {
      case 'ascending':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'descending':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <ArrowRight className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">Race Winner Predictions</CardTitle>
        <p className="text-sm text-muted-foreground">Italian Grand Prix</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px]">
          <div className="space-y-2">
            {MOCK_PREDICTIONS.map((prediction, index) => (
              <Link 
                key={prediction.rider.id} 
                to={`/riders/${prediction.rider.id}`}
                className="block hover:bg-gray-50 rounded-md transition-colors"
              >
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-racing-red text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{prediction.rider.full_name}</div>
                      <div className="text-sm text-gray-500">{prediction.rider.constructor?.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">
                      {(prediction.probability * 100).toFixed(0)}%
                    </span>
                    {getFormIcon(prediction.form)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </ScrollArea>
        <div className="text-xs text-gray-500 text-center mt-2">
          Based on historical data and current form
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictionWidget;

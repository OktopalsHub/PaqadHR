"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const KPIWidget = () => {
  const kpiData = [
    {
      title: "Total Employees",
      value: "156",
      change: "+12%",
      trend: "up" as const,
      icon: "👥",
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "New Hires",
      value: "8",
      change: "+3",
      trend: "up" as const,
      icon: "👶",
      color: "from-green-500 to-green-600",
    },
    {
      title: "Open Positions",
      value: "12",
      change: "-2",
      trend: "down" as const,
      icon: "🧑‍💼",
      color: "from-purple-500 to-purple-600",
    },
    {
      title: "Pending Leaves",
      value: "5",
      change: "+2",
      trend: "up" as const,
      icon: "🏖",
      color: "from-amber-500 to-amber-600",
    },
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "up":
        return "text-green-600 bg-green-50";
      case "down":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Key Performance Indicators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi, index) => (
            <div
              key={index}
              className="bg-white rounded-lg p-4 border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{kpi.icon}</span>
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getTrendColor(kpi.trend)}`}
                >
                  {getTrendIcon(kpi.trend)}
                  {kpi.change}
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                {kpi.title}
              </h3>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <div
                className={`w-full h-1 bg-gradient-to-r ${kpi.color} rounded-full mt-2 opacity-60`}
              ></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

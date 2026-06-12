import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const MetricWidget = () => {
  const metrics = [
    { title: "Avg Clock-in", value: "8:47 AM", trend: "+12 min", icon: "🕒" },
    {
      title: "Absences Today",
      value: "7",
      subtext: "employees out",
      icon: "📆",
    },
    { title: "Sick Leave", value: "42%", subtext: "of requests", icon: "🧾" },
    { title: "Time to Hire", value: "18 days", trend: "-3 days", icon: "⏱" },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Attendance & Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-white to-gray-50 rounded-lg p-4 border"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{metric.icon}</span>
                {metric.trend && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {metric.trend}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                {metric.title}
              </h3>
              <p className="text-xl font-bold text-gray-900">{metric.value}</p>
              {metric.subtext && (
                <p className="text-xs text-gray-500">{metric.subtext}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

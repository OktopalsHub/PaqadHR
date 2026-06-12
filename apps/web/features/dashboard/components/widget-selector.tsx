import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Clock, Zap, Calendar, X } from "lucide-react";
import { WidgetType } from "../types";

interface WidgetSelectorProps {
  onAddWidget: (type: WidgetType) => void;
  onClose: () => void;
}

export const WidgetSelector = ({
  onAddWidget,
  onClose,
}: WidgetSelectorProps) => {
  const widgetTypes = [
    {
      type: "kpi",
      name: "KPI Overview",
      icon: BarChart3,
      description: "Key performance indicators",
    },
    {
      type: "metrics",
      name: "Metrics",
      icon: Users,
      description: "Employee metrics and stats",
    },
    {
      type: "chart",
      name: "Charts",
      icon: BarChart3,
      description: "Visual data representations",
    },
    {
      type: "quickActions",
      name: "Quick Actions",
      icon: Zap,
      description: "Common HR actions",
    },
    {
      type: "attendance",
      name: "Attendance",
      icon: Clock,
      description: "Time tracking overview",
    },
    {
      type: "calendar",
      name: "Calendar",
      icon: Calendar,
      description: "Upcoming events and deadlines",
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto animate-scale-in">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Add Widget</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgetTypes.map((widget) => (
              <Card
                key={widget.type}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 hover:border-blue-200"
                onClick={() => onAddWidget(widget.type as WidgetType)}
              >
                <CardContent className="p-6 text-center">
                  <widget.icon className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="font-semibold mb-2">{widget.name}</h3>
                  <p className="text-sm text-gray-600">{widget.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

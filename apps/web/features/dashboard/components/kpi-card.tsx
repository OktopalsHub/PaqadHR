import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: string;
  color: string;
  description: string;
}

export const KPICard = ({
  title,
  value,
  change,
  trend,
  icon,
  color,
  description,
}: KPICardProps) => {
  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
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
    <Card className="relative overflow-hidden shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:scale-105">
      <div
        className={`absolute top-0 left-0 w-full h-1 ${color.replace("bg-gradient-to-r", "bg-gradient-to-r")}`}
      ></div>

      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{icon}</span>
              <h3 className="text-sm font-medium text-slate-600 leading-tight">
                {title}
              </h3>
            </div>

            <div className="space-y-2">
              <p className="text-3xl font-bold text-slate-800">{value}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full ${getTrendColor()}`}
          >
            {getTrendIcon()}
            <span className="text-xs font-semibold">{change}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

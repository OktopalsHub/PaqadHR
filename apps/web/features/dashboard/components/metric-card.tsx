import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  trend?: string;
  subtext?: string;
  icon: string;
  color: string;
}

export const MetricCard = ({
  title,
  value,
  trend,
  subtext,
  icon,
  color,
}: MetricCardProps) => {
  return (
    <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xl">{icon}</span>
          {trend && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {trend}
            </span>
          )}
        </div>

        <h3 className="text-sm font-medium text-slate-600 mb-2">{title}</h3>
        <p className="text-2xl font-bold text-slate-800 mb-1">{value}</p>
        {subtext && <p className="text-xs text-slate-500">{subtext}</p>}

        <div
          className={`w-full h-1 bg-gradient-to-r ${color} rounded-full mt-3 opacity-60`}
        ></div>
      </CardContent>
    </Card>
  );
};

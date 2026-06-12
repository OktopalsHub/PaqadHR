"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, Settings, Plus } from "lucide-react";
import { DashboardGrid } from "./dashboard-grid";
import { WidgetSelector } from "./widget-selector";
import { Widget, WidgetType, LayoutItem } from "../types";

export const Dashboard = () => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([
    {
      id: "kpi-1",
      type: "kpi",
      position: { x: 0, y: 0 },
      size: { w: 3, h: 2 },
    },
    {
      id: "metrics-1",
      type: "metrics",
      position: { x: 3, y: 0 },
      size: { w: 3, h: 2 },
    },
    {
      id: "chart-1",
      type: "chart",
      position: { x: 6, y: 0 },
      size: { w: 6, h: 3 },
    },
    {
      id: "quickActions-1",
      type: "quickActions",
      position: { x: 0, y: 2 },
      size: { w: 6, h: 2 },
    },
  ]);

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(widgets.filter((w) => w.id !== widgetId));
  };

  const handleAddWidget = (widgetType: WidgetType) => {
    const newWidget: Widget = {
      id: `${widgetType}-${Date.now()}`,
      type: widgetType,
      position: { x: 0, y: 0 },
      size: { w: 3, h: 2 },
    };
    setWidgets([...widgets, newWidget]);
    setShowWidgetSelector(false);
  };

  const handleLayoutChange = (layout: LayoutItem[]) => {
    const updatedWidgets = widgets.map((widget) => {
      const layoutItem = layout.find((item) => item.i === widget.id);
      if (layoutItem) {
        return {
          ...widget,
          position: { x: layoutItem.x, y: layoutItem.y },
          size: { w: layoutItem.w, h: layoutItem.h },
        };
      }
      return widget;
    });
    setWidgets(updatedWidgets);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/20 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back! Here&apos;s what&apos;s happening at your company
              today.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              Reports
            </Button>
            <Button
              variant={isCustomizing ? "default" : "outline"}
              onClick={() => setIsCustomizing(!isCustomizing)}
            >
              <Settings className="mr-2 h-4 w-4" />
              {isCustomizing ? "Done" : "Customize"}
            </Button>
            {isCustomizing && (
              <Button onClick={() => setShowWidgetSelector(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Widget
              </Button>
            )}
          </div>
        </div>

        {/* Customizable Dashboard Grid */}
        <DashboardGrid
          widgets={widgets}
          isCustomizing={isCustomizing}
          onRemoveWidget={handleRemoveWidget}
          onLayoutChange={handleLayoutChange}
        />

        {/* Widget Selector */}
        {showWidgetSelector && (
          <WidgetSelector
            onAddWidget={handleAddWidget}
            onClose={() => setShowWidgetSelector(false)}
          />
        )}
      </div>
    </div>
  );
};

import React from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { KPIWidget } from "./widgets/kpi-widget";
import { MetricWidget } from "./widgets/metric-widget";
import { ChartWidget } from "./widgets/chart-widget";
import { QuickActionsWidget } from "./widgets/quick-actions-widget";
import { Widget, LayoutItem } from "../types";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  widgets: Widget[];
  isCustomizing: boolean;
  onRemoveWidget: (widgetId: string) => void;
  onLayoutChange: (layout: LayoutItem[]) => void;
}

export const DashboardGrid = ({
  widgets,
  isCustomizing,
  onRemoveWidget,
  onLayoutChange,
}: DashboardGridProps) => {
  const renderWidget = (widget: Widget) => {
    const baseProps = {
      key: widget.id,
      className: `transition-all duration-200 ${isCustomizing ? "ring-2 ring-blue-200 ring-opacity-50" : ""}`,
    };

    let content;
    switch (widget.type) {
      case "kpi":
        content = <KPIWidget />;
        break;
      case "metrics":
        content = <MetricWidget />;
        break;
      case "chart":
        content = <ChartWidget />;
        break;
      case "quickActions":
        content = <QuickActionsWidget />;
        break;
      default:
        content = <div className="p-4 bg-gray-100 rounded">Unknown widget</div>;
    }

    return (
      <div {...baseProps}>
        <div className="relative h-full">
          {isCustomizing && (
            <Button
              size="sm"
              variant="destructive"
              className="absolute top-2 right-2 z-10 w-8 h-8 p-0"
              onClick={() => onRemoveWidget(widget.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          {content}
        </div>
      </div>
    );
  };

  const layout = widgets.map((widget) => ({
    i: widget.id,
    x: widget.position.x,
    y: widget.position.y,
    w: widget.size.w,
    h: widget.size.h,
    minW: 2,
    minH: 1,
  }));

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={120}
      isDraggable={isCustomizing}
      isResizable={isCustomizing}
      onLayoutChange={(currentLayout) =>
        onLayoutChange([...currentLayout] as LayoutItem[])
      }
      margin={[16, 16]}
    >
      {widgets.map(renderWidget)}
    </ResponsiveGridLayout>
  );
};

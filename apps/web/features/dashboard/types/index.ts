export type WidgetType =
  | "kpi"
  | "metrics"
  | "chart"
  | "quickActions"
  | "attendance"
  | "calendar";

export interface Widget {
  id: string;
  type: WidgetType;
  position: { x: number; y: number };
  size: { w: number; h: number };
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

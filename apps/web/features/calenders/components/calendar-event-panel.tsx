import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/lib/schemas/calendar";
import { EVENT_BADGE_STYLES, EVENT_COLORS } from "../lib/calendar-utils";

interface CalendarEventPanelProps {
  date: Date | undefined;
  events: CalendarEvent[];
}

export function CalendarEventPanel({ date, events }: CalendarEventPanelProps) {
  return (
    <div className="bg-white rounded-md border p-4">
      <h3 className="text-sm font-medium mb-4">
        {date ? <>Events for {format(date, "MMMM d, yyyy")}</> : <>Select a date</>}
      </h3>

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${EVENT_COLORS[event.type]}`}
                    />
                    <span className="text-sm font-medium">{event.title}</span>
                  </div>
                  <Badge
                    className={EVENT_BADGE_STYLES[event.type]}
                    variant="outline"
                  >
                    {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                  </Badge>
                </div>
                {event.time && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {event.time}
                  </div>
                )}
                {event.description && (
                  <div className="mt-1 text-sm">{event.description}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No events for {date?.toLocaleDateString() ?? "selected date"}.
        </p>
      )}
    </div>
  );
}

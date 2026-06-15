import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CalendarEventType } from "@/lib/schemas/calendar";
import { EVENT_COLORS } from "../lib/calendar-utils";

const FILTER_TYPES: { key: CalendarEventType; label: string }[] = [
  { key: "leave", label: "Leave" },
  { key: "celebration", label: "Celebration" },
  { key: "holiday", label: "Holiday" },
  { key: "meeting", label: "Meeting" },
  { key: "review", label: "Review" },
];

interface CalendarToolbarProps {
  selectedTypes: Record<string, boolean>;
  onToggleType: (type: string) => void;
  onSelectAll: () => void;
}

export function CalendarToolbar({
  selectedTypes,
  onToggleType,
  onSelectAll,
}: CalendarToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b p-4">
      <h2 className="text-lg font-semibold">Schedule</h2>
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filter events</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="p-2">
              {FILTER_TYPES.map(({ key, label }) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={selectedTypes[key]}
                  onCheckedChange={() => onToggleType(key)}
                >
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full ${EVENT_COLORS[key]}`}
                  />
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={onSelectAll}
              >
                Reset filters
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

import React from "react";
import { Button } from "@/components/ui/button";
import { Filter, Calendar, MapPin, Users } from "lucide-react";

interface FilterBarProps {
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
}

const FilterBar = ({ selectedFilter, onFilterChange }: FilterBarProps) => {
  const filters = [
    { id: "all", label: "All", icon: <Filter className="w-4 h-4" /> },
    {
      id: "department",
      label: "Department",
      icon: <Users className="w-4 h-4" />,
    },
    { id: "location", label: "Location", icon: <MapPin className="w-4 h-4" /> },
    {
      id: "timeframe",
      label: "This Month",
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-slate-600">Filter by:</span>
      {filters.map((filter) => (
        <Button
          key={filter.id}
          variant={selectedFilter === filter.id ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange(filter.id)}
          className={`flex items-center gap-2 ${
            selectedFilter === filter.id
              ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
              : "bg-white/80 hover:bg-blue-50"
          }`}
        >
          {filter.icon}
          {filter.label}
        </Button>
      ))}
    </div>
  );
};

export default FilterBar;

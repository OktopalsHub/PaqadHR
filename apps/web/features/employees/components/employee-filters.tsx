'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Department } from '@/lib/schemas/department';
import { STATUSES } from '../constants/';
import type { EmployeeFilters, ViewMode } from '../types/';
import { ViewModeToggle } from './view-mode-toggle';

interface EmployeeFiltersProps {
  filters: EmployeeFilters;
  departments: Department[];
  onFilterChange: (key: keyof EmployeeFilters, value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const EmployeeFiltersComponent = ({
  filters,
  departments,
  onFilterChange,
  viewMode,
  onViewModeChange,
}: EmployeeFiltersProps) => {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[8px] border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] lg:flex-row">
      <div className="relative w-full flex-1">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search employees..."
          className="h-10 rounded-[8px] border-slate-200 bg-white py-2 pr-3 pl-10 text-sm text-slate-700 shadow-none placeholder:text-slate-400 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24]"
          value={filters.searchTerm}
          onChange={(e) => onFilterChange('searchTerm', e.target.value)}
        />
      </div>

      <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
        <div className="min-w-[160px] flex-1 lg:flex-none">
          <Select
            value={filters.department || 'all_departments'}
            onValueChange={(value) => onFilterChange('department', value)}
          >
            <SelectTrigger className="h-10 w-full rounded-[8px] border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_departments">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px] flex-1 lg:flex-none">
          <Select
            value={filters.status || 'all_statuses'}
            onValueChange={(value) => onFilterChange('status', value)}
          >
            <SelectTrigger className="h-10 w-full rounded-[8px] border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#fbbf24]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
    </div>
  );
};

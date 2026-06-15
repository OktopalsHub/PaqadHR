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
import type { EmployeeFilters } from '../types/';

interface EmployeeFiltersProps {
  filters: EmployeeFilters;
  departments: Department[];
  onFilterChange: (key: keyof EmployeeFilters, value: string) => void;
}

export const EmployeeFiltersComponent = ({
  filters,
  departments,
  onFilterChange,
}: EmployeeFiltersProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="md:col-span-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search employees..."
            className="pl-9"
            value={filters.searchTerm}
            onChange={(e) => onFilterChange('searchTerm', e.target.value)}
          />
        </div>
      </div>
      <div>
        <Select
          value={filters.department || 'all_departments'}
          onValueChange={(value) => onFilterChange('department', value)}
        >
          <SelectTrigger className="w-full">
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
      <div>
        <Select
          value={filters.status || 'all_statuses'}
          onValueChange={(value) => onFilterChange('status', value)}
        >
          <SelectTrigger className="w-full">
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
    </div>
  );
};

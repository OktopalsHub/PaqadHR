"use client";

import { useState, useMemo } from "react";
import type { Employee, EmployeeFilters, ViewMode } from "../types/";
import {
  filterEmployees,
  paginateEmployees,
  calculatePageNumbers,
} from "../utils";

interface UseEmployeeFiltersProps {
  employees: Employee[];
}

export const useEmployeeFilters = ({ employees }: UseEmployeeFiltersProps) => {
  const [filters, setFilters] = useState<EmployeeFilters>({
    searchTerm: "",
    department: "",
    status: "",
  });
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  const filteredEmployees = useMemo(() => {
    return filterEmployees(
      employees,
      filters.searchTerm,
      filters.department,
      filters.status,
    );
  }, [employees, filters]);

  const currentEmployees = useMemo(() => {
    return paginateEmployees(filteredEmployees, currentPage, itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const pageNumbers = useMemo(() => {
    return calculatePageNumbers(filteredEmployees.length, itemsPerPage);
  }, [filteredEmployees.length, itemsPerPage]);

  const updateFilter = (key: keyof EmployeeFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const updateItemsPerPage = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  return {
    filters,
    viewMode,
    currentPage,
    itemsPerPage,
    filteredEmployees,
    currentEmployees,
    pageNumbers,
    updateFilter,
    setViewMode,
    setCurrentPage,
    updateItemsPerPage,
  };
};

import type { Employee } from "../types";

export const getStatusStyles = (status: Employee["status"]): string => {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-800";
    case "On Leave":
      return "bg-amber-100 text-amber-800";
    case "Inactive":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const filterEmployees = (
  employees: Employee[],
  searchTerm: string,
  department: string,
  status: string,
): Employee[] => {
  return employees
    .filter(
      (employee) =>
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.role.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .filter(
      (employee) =>
        (department === "" ||
          department === "all_departments" ||
          employee.department === department) &&
        (status === "" ||
          status === "all_statuses" ||
          employee.status === status),
    );
};

export const paginateEmployees = (
  employees: Employee[],
  currentPage: number,
  itemsPerPage: number,
): Employee[] => {
  const indexOfLastEmployee = currentPage * itemsPerPage;
  const indexOfFirstEmployee = indexOfLastEmployee - itemsPerPage;
  return employees.slice(indexOfFirstEmployee, indexOfLastEmployee);
};

export const calculatePageNumbers = (
  totalItems: number,
  itemsPerPage: number,
): number[] => {
  const pageNumbers = [];
  for (let i = 1; i <= Math.ceil(totalItems / itemsPerPage); i++) {
    pageNumbers.push(i);
  }
  return pageNumbers;
};

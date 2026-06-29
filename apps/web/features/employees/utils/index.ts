import type { Employee } from '../types';

export const getStatusStyles = (status: Employee['status']): string => {
  switch (status) {
    case 'Active':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-450 dark:border-green-900';
    case 'On Leave':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900';
    case 'Inactive':
      return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-800';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-800';
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
        (department === '' ||
          department === 'all_departments' ||
          employee.department === department) &&
        (status === '' || status === 'all_statuses' || employee.status === status),
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

export const calculatePageNumbers = (totalItems: number, itemsPerPage: number): number[] => {
  const pageNumbers = [];
  for (let i = 1; i <= Math.ceil(totalItems / itemsPerPage); i++) {
    pageNumbers.push(i);
  }
  return pageNumbers;
};

import { BadRequestException } from '@nestjs/common';
export class DateValidationUtil {
  static validateMonth(month: string | number): number {
    const monthNum = typeof month === 'string' ? parseInt(month) : month;
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new BadRequestException(
        'Month must be a valid number between 1 and 12',
      );
    }
    return monthNum;
  }
  static validateYear(year: string | number): number {
    const yearNum = typeof year === 'string' ? parseInt(year) : year;
    const currentYear = new Date().getFullYear();
    const minYear = 2000; 
    const maxYear = currentYear + 1; 
    if (isNaN(yearNum) || yearNum < minYear || yearNum > maxYear) {
      throw new BadRequestException(
        `Year must be a valid number between ${minYear} and ${maxYear}`,
      );
    }
    return yearNum;
  }
  static validateDateString(dateString: string): Date {
    if (!dateString) {
      throw new BadRequestException('Date parameter is required');
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        'Invalid date format. Please use YYYY-MM-DD format',
      );
    }
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();
    if (dateYear < 2000 || dateYear > currentYear + 1) {
      throw new BadRequestException(
        `Date year must be between 2000 and ${currentYear + 1}`,
      );
    }
    return date;
  }
  static validateMonthYear(
    month: string | number,
    year: string | number,
  ): { month: number; year: number } {
    const validMonth = this.validateMonth(month);
    const validYear = this.validateYear(year);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    if (validYear === currentYear && validMonth > currentMonth) {
      throw new BadRequestException(
        'Cannot request attendance data for future months',
      );
    }
    if (validYear > currentYear) {
      throw new BadRequestException(
        'Cannot request attendance data for future years',
      );
    }
    return { month: validMonth, year: validYear };
  }
}

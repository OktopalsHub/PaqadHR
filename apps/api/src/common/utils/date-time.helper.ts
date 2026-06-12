import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export class DateTimeHelper {
  /**
   * Returns the start of the UTC day for the given date.
   */
  static getStartOfUtcDay(date: Date | string | number = new Date()): Date {
    return dayjs.utc(date).startOf('day').toDate();
  }

  /**
   * Returns the start of the UTC month for the given date.
   */
  static getStartOfUtcMonth(date: Date | string | number = new Date()): Date {
    return dayjs.utc(date).startOf('month').toDate();
  }

  /**
   * Checks if the given date is in the current UTC month.
   */
  static isCurrentMonth(date: Date | string | number | null | undefined): boolean {
    if (!date) return false;
    const now = dayjs.utc();
    const targetDate = dayjs.utc(date);
    return now.year() === targetDate.year() && now.month() === targetDate.month();
  }
}

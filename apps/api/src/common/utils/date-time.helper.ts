import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(utc);
dayjs.extend(weekOfYear);
dayjs.extend(quarterOfYear);

export type AllowancePeriod = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

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

  static getPeriodStart(
    period: AllowancePeriod = 'monthly',
    date: Date | string | number = new Date(),
  ): Date {
    const d = dayjs.utc(date);
    switch (period) {
      case 'weekly':
        return d.startOf('week').toDate();
      case 'biweekly': {
        const weekStart = d.startOf('week');
        const weekIndex = Math.floor(weekStart.valueOf() / (7 * 24 * 60 * 60 * 1000));
        return weekIndex % 2 === 0
          ? weekStart.toDate()
          : weekStart.subtract(1, 'week').toDate();
      }
      case 'quarterly':
        return d.startOf('quarter').toDate();
      case 'yearly':
        return d.startOf('year').toDate();
      case 'monthly':
      default:
        return d.startOf('month').toDate();
    }
  }

  static isCurrentPeriod(
    lastResetDate: Date | string | number | null | undefined,
    period: AllowancePeriod = 'monthly',
  ): boolean {
    if (!lastResetDate) return false;
    const periodStart = this.getPeriodStart(period);
    return !dayjs.utc(lastResetDate).isBefore(dayjs.utc(periodStart), 'day');
  }
}

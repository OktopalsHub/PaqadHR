import { UnprocessableEntityException } from '@nestjs/common';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { HolidayService } from '../../modules/v1/tenant-settings/services/holiday.service';
import type { HolidaySettings } from '../interfaces/holiday-settings.interface';

dayjs.extend(duration);
export class DateTimeHelper {
  private static holidayService = new HolidayService();
  static calculateDuration(
    startDate: Date | string,
    endDate: Date | string,
    holidaySettings?: HolidaySettings,
    countryCode?: string,
  ): {
    startDate: string;
    endDate: string;
    durationInDays: number;
    workingDays?: number;
  } {
    const start = dayjs(startDate).startOf('day');
    const end = dayjs(endDate).startOf('day');
    if (!start.isValid() || !end.isValid()) {
      throw new UnprocessableEntityException('Invalid date format');
    }
    if (end.isBefore(start)) {
      throw new UnprocessableEntityException('End date cannot be before start date');
    }
    const durationInDays = end.diff(start, 'day') + 1;
    let workingDays: number | undefined;
    if (holidaySettings) {
      workingDays = DateTimeHelper.calculateWorkingDays(
        startDate,
        endDate,
        holidaySettings,
        countryCode,
      );
    }
    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      durationInDays,
      workingDays,
    };
  }
  static calculateWorkingDays(
    startDate: Date | string,
    endDate: Date | string,
    holidaySettings: HolidaySettings,
    countryCode?: string,
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return DateTimeHelper.holidayService.calculateWorkingDays(
      start,
      end,
      countryCode,
      holidaySettings,
    );
  }
  static isHoliday(
    date: Date | string,
    holidaySettings: HolidaySettings,
    countryCode?: string,
  ): boolean {
    const dateObj = new Date(date);
    return DateTimeHelper.holidayService.isHoliday(dateObj, countryCode || '', holidaySettings);
  }
  static isWeekend(date: Date | string, weekendDays: number[] = [0, 6]): boolean {
    const dateObj = new Date(date);
    return weekendDays.includes(dateObj.getDay());
  }
}

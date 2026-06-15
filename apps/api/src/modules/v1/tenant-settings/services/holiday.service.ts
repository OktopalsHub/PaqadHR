import { Injectable } from '@nestjs/common';
import Holidays from 'date-holidays';
import type { Holiday } from '../../../../common/interfaces/holiday.interface';
import type { HolidaySettings } from '../../../../common/interfaces/holiday-settings.interface';

@Injectable()
export class HolidayService {
  private holidaysInstances: Map<string, Holidays> = new Map();
  private getHolidaysInstance(countryCode: string): Holidays {
    const upperCode = countryCode.toUpperCase();
    if (!this.holidaysInstances.has(upperCode)) {
      const hd = new Holidays(upperCode);
      this.holidaysInstances.set(upperCode, hd);
    }
    return this.holidaysInstances.get(upperCode)!;
  }
  getCountryHolidays(countryCode: string): Holiday[] {
    try {
      const hd = this.getHolidaysInstance(countryCode);
      const currentYear = new Date().getFullYear();
      const holidays = hd.getHolidays(currentYear);
      return holidays.map((h) => ({
        id: `${countryCode.toLowerCase()}-${h.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: h.name,
        date: h.date.substring(5),
        type: this.mapHolidayType(h.type),
        recurring: true,
      }));
    } catch (_error) {
      return [];
    }
  }
  getSupportedCountries(): string[] {
    const hd = new Holidays();
    const countries = hd.getCountries();
    return Object.keys(countries);
  }
  private mapHolidayType(type?: string): 'national' | 'religious' | 'custom' {
    if (!type) return 'custom';
    const lowerType = type.toLowerCase();
    if (
      lowerType.includes('religious') ||
      lowerType.includes('christian') ||
      lowerType.includes('islamic')
    ) {
      return 'religious';
    }
    if (
      lowerType.includes('public') ||
      lowerType.includes('national') ||
      lowerType.includes('bank')
    ) {
      return 'national';
    }
    return 'custom';
  }
  isHoliday(date: Date, countryCode: string, holidaySettings: HolidaySettings): boolean {
    const dateStr = date.toISOString().split('T')[0];
    const monthDay = dateStr.substring(5);
    for (const holiday of holidaySettings.customHolidays) {
      if (holiday.recurring) {
        if (holiday.date === monthDay) {
          return true;
        }
      } else {
        if (holiday.date === dateStr) {
          return true;
        }
      }
    }
    if (countryCode) {
      try {
        const hd = this.getHolidaysInstance(countryCode);
        const year = date.getFullYear();
        const holidays = hd.getHolidays(year);
        return holidays.some((h) => h.date === dateStr);
      } catch (_error) {
        return false;
      }
    }
    return false;
  }
  calculateWorkingDays(
    startDate: Date,
    endDate: Date,
    countryCode: string | undefined,
    holidaySettings: HolidaySettings,
    weekendDays: number[] = [0, 6],
  ): number {
    let workingDays = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (holidaySettings.excludeWeekends && weekendDays.includes(dayOfWeek)) {
        current.setDate(current.getDate() + 1);
        continue;
      }
      if (this.isHoliday(current, countryCode || '', holidaySettings)) {
        current.setDate(current.getDate() + 1);
        continue;
      }
      workingDays++;
      current.setDate(current.getDate() + 1);
    }
    return workingDays;
  }
  getHolidaysForYear(
    year: number,
    countryCode: string,
    holidaySettings: HolidaySettings,
  ): Holiday[] {
    const holidays: Holiday[] = [];
    if (countryCode) {
      try {
        const hd = this.getHolidaysInstance(countryCode);
        const countryHolidays = hd.getHolidays(year);
        for (const h of countryHolidays) {
          holidays.push({
            id: `${countryCode.toLowerCase()}-${h.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: h.name,
            date: h.date,
            type: this.mapHolidayType(h.type),
            recurring: true,
          });
        }
      } catch (_error) {}
    }
    for (const holiday of holidaySettings.customHolidays) {
      if (holiday.recurring) {
        holidays.push({
          ...holiday,
          date: `${year}-${holiday.date}`,
        });
      } else {
        holidays.push(holiday);
      }
    }
    return holidays;
  }
  validateHoliday(holiday: Partial<Holiday>): boolean {
    if (!holiday.name || !holiday.date || !holiday.type) {
      return false;
    }
    if (holiday.recurring) {
      const dateRegex = /^\d{2}-\d{2}$/;
      return dateRegex.test(holiday.date);
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      return dateRegex.test(holiday.date);
    }
  }
}

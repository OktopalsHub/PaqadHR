import { Injectable } from '@nestjs/common';
import Holidays from 'date-holidays';
import type { Holiday } from '../../../../common/interfaces/holiday.interface';
import type { HolidaySettings } from '../../../../common/interfaces/holiday-settings.interface';
import { GoogleCalendarHolidayProvider } from './google-calendar-holiday.provider';

function normalizeHolidayDate(raw: string, year?: number): string {
  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];

  const monthDay = raw.match(/(\d{2}-\d{2})/);
  if (monthDay && year) return `${year}-${monthDay[1]}`;

  return raw.slice(0, 10);
}

function recurringHolidayDate(year: number, date: string): string {
  const normalized = normalizeHolidayDate(date, year);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return `${year}-${date}`;
}

export const defaultHolidaySettings = (): HolidaySettings => ({
  customHolidays: [],
  excludeWeekends: true,
});

@Injectable()
export class HolidayService {
  private holidaysInstances: Map<string, Holidays> = new Map();
  private readonly googleCalendarHolidays: GoogleCalendarHolidayProvider;

  constructor(googleCalendarHolidays?: GoogleCalendarHolidayProvider) {
    this.googleCalendarHolidays = googleCalendarHolidays ?? new GoogleCalendarHolidayProvider();
  }
  private getHolidaysInstance(countryCode: string): Holidays {
    const upperCode = countryCode.toUpperCase();
    if (!this.holidaysInstances.has(upperCode)) {
      const hd = new Holidays(upperCode);
      this.holidaysInstances.set(upperCode, hd);
    }
    return this.holidaysInstances.get(upperCode)!;
  }

  getCountryHolidays(countryCode: string): Holiday[] {
    return this.getLocalHolidaysForYear(countryCode, new Date().getFullYear()).map((holiday) => ({
      ...holiday,
      date: holiday.date.slice(5),
    }));
  }

  usesGoogleCalendarHolidays(): boolean {
    return this.googleCalendarHolidays.isConfigured();
  }

  async getCountryHolidaysFromProvider(countryCode: string, year?: number): Promise<Holiday[]> {
    const targetYear = year ?? new Date().getFullYear();
    const googleHolidays = await this.googleCalendarHolidays.fetchHolidaysForYear(
      countryCode,
      targetYear,
    );
    if (googleHolidays.length > 0) {
      return googleHolidays.map((holiday) => ({
        ...holiday,
        date: holiday.date.slice(5),
      }));
    }
    return this.getCountryHolidays(countryCode);
  }
  getSupportedCountries(): string[] {
    const hd = new Holidays();
    const countries = hd.getCountries();
    return Object.keys(countries);
  }
  getSupportedCountriesWithNames(): Array<{ code: string; name: string }> {
    const hd = new Holidays();
    const countries = hd.getCountries();
    return Object.entries(countries)
      .map(([code, name]) => ({ code, name: String(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
    for (const holiday of holidaySettings?.customHolidays ?? []) {
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
        return holidays.some((h) => normalizeHolidayDate(String(h.date), year) === dateStr);
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
  async getHolidaysForYear(
    year: number,
    countryCode: string,
    holidaySettings?: HolidaySettings,
  ): Promise<Holiday[]> {
    const settings = holidaySettings ?? defaultHolidaySettings();
    let holidays: Holiday[] = [];

    if (countryCode) {
      const googleHolidays = await this.googleCalendarHolidays.fetchHolidaysForYear(
        countryCode,
        year,
      );
      holidays =
        googleHolidays.length > 0
          ? googleHolidays
          : this.getLocalHolidaysForYear(countryCode, year);
    }

    for (const holiday of settings.customHolidays ?? []) {
      if (holiday.recurring) {
        holidays.push({
          ...holiday,
          date: recurringHolidayDate(year, holiday.date),
        });
      } else if (holiday.date.startsWith(String(year))) {
        holidays.push(holiday);
      }
    }

    return holidays;
  }

  private getLocalHolidaysForYear(countryCode: string, year: number): Holiday[] {
    const holidays: Holiday[] = [];
    try {
      const hd = this.getHolidaysInstance(countryCode);
      const countryHolidays = hd.getHolidays(year);
      for (const h of countryHolidays) {
        const date = normalizeHolidayDate(String(h.date), year);
        holidays.push({
          id: `${countryCode.toLowerCase()}-${year}-${h.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: h.name,
          date,
          type: this.mapHolidayType(h.type),
          recurring: true,
        });
      }
    } catch (_error) {}
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

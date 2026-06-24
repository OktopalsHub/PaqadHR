import type { Holiday } from './holiday.interface';

export interface HolidaySettings {
  countryCode?: string;
  customHolidays: Holiday[];
  excludeWeekends: boolean;
}

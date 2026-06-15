import type { Holiday } from './holiday.interface';

export interface HolidaySettings {
  customHolidays: Holiday[];
  excludeWeekends: boolean;
}

import { Injectable, Logger } from "@nestjs/common";

import { ENVIRONMENT } from "../../../../common/config/env.config";
import type { Holiday } from "../../../../common/interfaces/holiday.interface";
import { buildGoogleHolidayCalendarId } from "../constants/google-holiday-regions";

const GOOGLE_CALENDAR_API_BASE =
  "https://www.googleapis.com/calendar/v3/calendars";
const PUBLIC_HOLIDAY_CALENDAR_SUFFIX = "holiday@group.v.calendar.google.com";

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
};

function isObservanceOnly(event: GoogleCalendarEvent): boolean {
  const description = event.description?.trim() ?? "";
  return description.startsWith("Observance");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapGoogleEventToHoliday(
  event: GoogleCalendarEvent,
  countryCode: string,
  year: number,
): Holiday | null {
  const date = event.start?.date;
  const name = event.summary?.trim();
  if (!date || !name || !date.startsWith(String(year))) return null;

  return {
    id: `${countryCode.toLowerCase()}-${year}-${slugify(name)}`,
    name,
    date,
    type: inferHolidayType(name, event.description),
    recurring: true,
  };
}

function inferHolidayType(
  name: string,
  description?: string,
): "national" | "religious" | "custom" {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  if (
    text.includes("eid") ||
    text.includes("ramadan") ||
    text.includes("christmas") ||
    text.includes("easter") ||
    text.includes("good friday") ||
    text.includes("islamic") ||
    text.includes("diwali")
  ) {
    return "religious";
  }
  return "national";
}

const HOLIDAY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class GoogleCalendarHolidayProvider {
  private readonly logger = new Logger(GoogleCalendarHolidayProvider.name);
  private readonly cache = new Map<
    string,
    { holidays: Holiday[]; expiresAt: number }
  >();
  private readonly inFlight = new Map<string, Promise<Holiday[]>>();

  isConfigured(): boolean {
    return Boolean(ENVIRONMENT.GOOGLE.CALENDAR_API_KEY?.trim());
  }

  /**
   * Public holidays change at most a few times a year, so answers are kept for a
   * day and concurrent requests for the same country and year share one call.
   * Failed lookups are never cached, so a Google outage heals on the next request.
   */
  async fetchHolidaysForYear(
    countryCode: string,
    year: number,
  ): Promise<Holiday[]> {
    const apiKey = ENVIRONMENT.GOOGLE.CALENDAR_API_KEY?.trim();
    if (!apiKey || !countryCode.trim()) return [];

    const cacheKey = `${countryCode.trim().toUpperCase()}:${year}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now())
      return cached.holidays.map((h) => ({ ...h }));

    let pending = this.inFlight.get(cacheKey);
    if (!pending) {
      pending = this.requestHolidays(apiKey, countryCode, year)
        .then((holidays) => {
          if (holidays) {
            this.cache.set(cacheKey, {
              holidays,
              expiresAt: Date.now() + HOLIDAY_CACHE_TTL_MS,
            });
          }
          return holidays ?? [];
        })
        .finally(() => this.inFlight.delete(cacheKey));
      this.inFlight.set(cacheKey, pending);
    }
    return (await pending).map((h) => ({ ...h }));
  }

  /** Returns null when the lookup failed, so callers can tell failure from "no holidays". */
  private async requestHolidays(
    apiKey: string,
    countryCode: string,
    year: number,
  ): Promise<Holiday[] | null> {
    const calendarId = buildGoogleHolidayCalendarId(countryCode);
    const params = new URLSearchParams({
      key: apiKey,
      timeMin: `${year}-01-01T00:00:00Z`,
      timeMax: `${year}-12-31T23:59:59Z`,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
    });

    const url = `${GOOGLE_CALENDAR_API_BASE}/${calendarId}/events?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(
          `Google Calendar holidays failed for ${countryCode} ${year}: ${response.status} ${body.slice(0, 200)}`,
        );
        return null;
      }

      const data = (await response.json()) as GoogleCalendarEventsResponse;
      const holidays: Holiday[] = [];

      for (const event of data.items ?? []) {
        if (isObservanceOnly(event)) continue;
        const mapped = mapGoogleEventToHoliday(event, countryCode, year);
        if (mapped) holidays.push(mapped);
      }

      return holidays;
    } catch (error) {
      this.logger.warn(
        `Google Calendar holidays request failed for ${countryCode} ${year}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }
}

export { PUBLIC_HOLIDAY_CALENDAR_SUFFIX };

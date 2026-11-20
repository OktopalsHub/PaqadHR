import { GoogleCalendarHolidayProvider } from "./google-calendar-holiday.provider";

jest.mock("../../../../common/config/env.config", () => ({
  ENVIRONMENT: { GOOGLE: { CALENDAR_API_KEY: "test-key" } },
}));

function googleResponse(summary: string, date: string) {
  return {
    ok: true,
    json: async () => ({ items: [{ summary, start: { date } }] }),
    text: async () => "",
  };
}

describe("GoogleCalendarHolidayProvider caching", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let provider: GoogleCalendarHolidayProvider;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    provider = new GoogleCalendarHolidayProvider();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("serves repeat lookups for the same country and year from memory", async () => {
    fetchMock.mockResolvedValue(googleResponse("New Year", "2026-01-01"));

    const first = await provider.fetchHolidaysForYear("NG", 2026);
    const second = await provider.fetchHolidaysForYear("ng", 2026);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    await provider.fetchHolidaysForYear("NG", 2027);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent lookups", async () => {
    fetchMock.mockResolvedValue(googleResponse("New Year", "2026-01-01"));

    await Promise.all([
      provider.fetchHolidaysForYear("NG", 2026),
      provider.fetchHolidaysForYear("NG", 2026),
      provider.fetchHolidaysForYear("NG", 2026),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed lookup", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "down",
      })
      .mockResolvedValueOnce(googleResponse("New Year", "2026-01-01"));

    expect(await provider.fetchHolidaysForYear("NG", 2026)).toEqual([]);
    const retry = await provider.fetchHolidaysForYear("NG", 2026);

    expect(retry).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns copies so callers cannot corrupt the cache", async () => {
    fetchMock.mockResolvedValue(googleResponse("New Year", "2026-01-01"));

    const first = await provider.fetchHolidaysForYear("NG", 2026);
    first.push({
      id: "x",
      name: "Injected",
      date: "2026-02-02",
      type: "custom",
      recurring: false,
    });
    first[0].name = "Changed";

    const second = await provider.fetchHolidaysForYear("NG", 2026);
    expect(second).toHaveLength(1);
    expect(second[0].name).toBe("New Year");
  });
});

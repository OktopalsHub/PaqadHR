/**
 * Run: npx tsx apps/api/src/modules/v1/tenant-members/utils/anniversary-years.check.ts
 */
function anniversaryYearsThisCalendarYear(startDate: Date, asOf: Date): number {
  return asOf.getFullYear() - startDate.getFullYear();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const asOf = new Date('2026-07-15T12:00:00Z');
assert(anniversaryYearsThisCalendarYear(new Date('2026-07-01'), asOf) === 0, 'same year = 0');
assert(anniversaryYearsThisCalendarYear(new Date('2025-07-01'), asOf) === 1, '1 year');
assert(anniversaryYearsThisCalendarYear(new Date('2024-07-01'), asOf) === 2, '2 years');
assert(anniversaryYearsThisCalendarYear(new Date('2026-07-01'), asOf) < 1, 'filter year-0');

export {};

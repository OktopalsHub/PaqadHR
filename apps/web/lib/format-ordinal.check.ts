/**
 * Run: npx tsx apps/web/lib/format-ordinal.check.ts
 */
import { formatOrdinal } from './format-ordinal';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(formatOrdinal(1) === '1st', '1st');
assert(formatOrdinal(2) === '2nd', '2nd');
assert(formatOrdinal(3) === '3rd', '3rd');
assert(formatOrdinal(4) === '4th', '4th');
assert(formatOrdinal(11) === '11th', '11th');
assert(formatOrdinal(12) === '12th', '12th');
assert(formatOrdinal(13) === '13th', '13th');
assert(formatOrdinal(21) === '21st', '21st');
assert(formatOrdinal(22) === '22nd', '22nd');

console.log('format-ordinal.check: ok');

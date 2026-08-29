import { createHash } from 'node:crypto';
import { buildDeletedUserEmail } from './user-tombstone.util';

describe('buildDeletedUserEmail', () => {
  it('uses opaque hash and internal tombstone domain without original email', () => {
    const tombstone = buildDeletedUserEmail('user-abc-123');
    expect(tombstone).toMatch(/^deleted_\d+_[a-f0-9]{16}@anonymized\.paqad\.local$/);
    expect(tombstone).not.toContain('gmail');
    expect(tombstone.length).toBeLessThanOrEqual(100);
  });

  it('is unique per user id via hash suffix', () => {
    const a = buildDeletedUserEmail('user-a');
    const b = buildDeletedUserEmail('user-b');
    expect(a).not.toBe(b);
  });

  it('truncates to varchar limit when needed', () => {
    const longId = createHash('sha256').update('long').digest('hex');
    const tombstone = buildDeletedUserEmail(longId.repeat(4));
    expect(tombstone.length).toBeLessThanOrEqual(100);
  });
});

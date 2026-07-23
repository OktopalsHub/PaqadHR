import assert from 'node:assert/strict';

type Role = 'owner' | 'admin' | 'member';
type Member = { id: string; role: Role };

function isTenantAdmin(member: Member): boolean {
  return member.role === 'admin' || member.role === 'owner';
}

function assertSelfOnly(actor: Member, targetMemberId: string): void {
  if (actor.id !== targetMemberId) {
    throw new Error('You can only edit your own personal information');
  }
}

const admin: Member = { id: 'a1', role: 'admin' };
const owner: Member = { id: 'o1', role: 'owner' };
const member: Member = { id: 'm1', role: 'member' };

assert.equal(isTenantAdmin(admin), true);
assert.equal(isTenantAdmin(owner), true);
assert.equal(isTenantAdmin(member), false);

assertSelfOnly(member, 'm1');
assert.throws(() => assertSelfOnly(admin, 'm1'), /own personal information/);
assert.throws(() => assertSelfOnly(member, 'other'), /own personal information/);

console.log('member-access.check: ok');

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDashboardKpis,
  type DashboardKpiInput,
  resolveDashboardRole,
} from './dashboard-kpis.ts';

const base: DashboardKpiInput = {
  role: 'admin',
  leaveCounts: { pending: 1, onLeaveToday: 1 },
  leavesLoading: false,
  employeeSummary: { activeEmployees: 12, departments: 3 },
  teamSize: 4,
};

const labels = (cards: { label: string }[]) => cards.map((card) => card.label);

test('resolves the role from admin status and direct reports', () => {
  assert.equal(resolveDashboardRole(true, 0), 'admin');
  assert.equal(resolveDashboardRole(false, 2), 'manager');
  assert.equal(resolveDashboardRole(false, 0), 'member');
});

test('admin sees company-wide cards and plan-gated ones only when available', () => {
  const full = buildDashboardKpis({
    ...base,
    attendanceStats: {
      totalPresent: 8,
      totalLate: 1,
      totalHalfDay: 0,
      totalAbsent: 2,
      totalOnLeave: 1,
    },
    payrollSetup: { totalEmployees: 12, paymentReadyCount: 10 },
    openRoles: { count: 2, activeCandidates: 5, loading: false },
  });
  assert.deepEqual(labels(full), [
    'Headcount',
    'Present today',
    'Pending approvals',
    'Payroll ready',
    'Open roles',
  ]);
  assert.equal(full[1].value, '9/12');
  assert.equal(full[2].hint, '1 on leave today');
  assert.equal(full[3].hint, '2 missing payment details');

  const noAttendance = buildDashboardKpis({ ...base, attendanceStats: null });
  assert.deepEqual(labels(noAttendance), ['Headcount', 'On leave today', 'Pending approvals']);
});

test('manager sees the team and their own balance', () => {
  const cards = buildDashboardKpis({
    ...base,
    role: 'manager',
    leaveBalances: [{ remaining: 10 }, { remaining: 4 }],
  });
  assert.deepEqual(labels(cards), [
    'My team',
    'Team on leave today',
    'Pending approvals',
    'Leave balance',
  ]);
  assert.equal(cards[0].value, 4);
  assert.equal(cards[1].value, 1);
  assert.equal(cards[3].value, '14d');
});

test('member sees personal cards and skips the ones without data', () => {
  const cards = buildDashboardKpis({
    ...base,
    role: 'member',
    leaveBalances: [{ remaining: 8 }],
    clockIn: { status: 'ok', isOnLeave: false, clockedInAt: '09:02' },
    points: { currentBalance: 120, monthlyReceived: 30 },
  });
  assert.deepEqual(labels(cards), [
    'Leave balance',
    'Today',
    'My pending requests',
    'Points balance',
  ]);
  assert.equal(cards[1].value, 'Clocked in');

  const minimal = buildDashboardKpis({ ...base, role: 'member' });
  assert.deepEqual(labels(minimal), ['Leave balance', 'My pending requests']);
  assert.equal(minimal[0].value, '—');
});

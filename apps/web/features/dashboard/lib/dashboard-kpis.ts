export type DashboardRole = 'admin' | 'manager' | 'member';

export type DashboardKpiIcon =
  | 'users'
  | 'userCheck'
  | 'calendarClock'
  | 'clipboardCheck'
  | 'wallet'
  | 'briefcase'
  | 'clock'
  | 'gift'
  | 'palmtree';

export type DashboardKpi = {
  key: string;
  label: string;
  value: number | string;
  hint: string;
  icon: DashboardKpiIcon;
  tone: 'warning' | 'success' | 'info' | 'indigo';
  href?: string;
};

type LeaveLike = { status?: string; startDate: string; endDate: string };

export type DashboardKpiInput = {
  role: DashboardRole;
  today: string;
  leaves: LeaveLike[];
  leavesLoading: boolean;
  employeeSummary?: { activeEmployees: number; departments: number };
  teamSize: number;
  /** null = the plan has no attendance, undefined = still loading. */
  attendanceStats?: {
    totalPresent: number;
    totalLate: number;
    totalHalfDay: number;
    totalAbsent: number;
    totalOnLeave: number;
  } | null;
  payrollSetup?: { totalEmployees: number; paymentReadyCount: number } | null;
  openRoles?: { count: number; activeCandidates: number; loading: boolean } | null;
  leaveBalances?: { remaining: number }[];
  clockIn?: { status: string; isOnLeave: boolean; clockedInAt?: string | null } | null;
  points?: { currentBalance: number; monthlyReceived: number } | null;
};

const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

const isApproved = (leave: LeaveLike) => leave.status?.toLowerCase() === 'approved';
const isPending = (leave: LeaveLike) => leave.status?.toLowerCase() === 'pending';
const coversDay = (leave: LeaveLike, day: string) =>
  String(leave.startDate).slice(0, 10) <= day && String(leave.endDate).slice(0, 10) >= day;

export function resolveDashboardRole(isAdmin: boolean, directReports: number): DashboardRole {
  if (isAdmin) return 'admin';
  return directReports > 0 ? 'manager' : 'member';
}

export function buildDashboardKpis(input: DashboardKpiInput): DashboardKpi[] {
  const { role, today, leaves, leavesLoading } = input;
  const onLeaveToday = leaves.filter((leave) => isApproved(leave) && coversDay(leave, today));
  const pending = leaves.filter(isPending);
  const leaveValue = (count: number) => (leavesLoading ? '—' : count);

  const pendingApprovals: DashboardKpi = {
    key: 'pending-approvals',
    label: 'Pending approvals',
    value: leaveValue(pending.length),
    hint: pending.length === 0 ? 'Nothing waiting on you' : 'Leave requests waiting on you',
    icon: 'clipboardCheck',
    tone: 'info',
    href: 'leaves',
  };

  if (role === 'admin') {
    const cards: DashboardKpi[] = [
      {
        key: 'headcount',
        label: 'Headcount',
        value: input.employeeSummary ? input.employeeSummary.activeEmployees : '—',
        hint: input.employeeSummary
          ? `Active employees · ${input.employeeSummary.departments} ${plural(input.employeeSummary.departments, 'department')}`
          : 'Active employees',
        icon: 'users',
        tone: 'warning',
        href: 'employees',
      },
    ];
    if (input.attendanceStats !== null) {
      const stats = input.attendanceStats;
      const headcount = input.employeeSummary?.activeEmployees;
      const showedUp = stats ? stats.totalPresent + stats.totalLate + stats.totalHalfDay : 0;
      cards.push({
        key: 'present-today',
        label: 'Present today',
        value: stats ? (headcount === undefined ? showedUp : `${showedUp}/${headcount}`) : '—',
        hint: stats
          ? `${stats.totalLate} late · ${stats.totalAbsent} absent`
          : 'Checking attendance…',
        icon: 'userCheck',
        tone: 'success',
        href: 'attendance',
      });
    } else {
      cards.push({
        key: 'on-leave-today',
        label: 'On leave today',
        value: leaveValue(onLeaveToday.length),
        hint: 'Approved leave covering today',
        icon: 'palmtree',
        tone: 'success',
        href: 'leaves',
      });
    }
    cards.push({ ...pendingApprovals, hint: `${onLeaveToday.length} on leave today` });
    if (input.payrollSetup) {
      const { paymentReadyCount, totalEmployees } = input.payrollSetup;
      cards.push({
        key: 'payroll-ready',
        label: 'Payroll ready',
        value: `${paymentReadyCount}/${totalEmployees}`,
        hint:
          totalEmployees === 0
            ? 'Add employees to set up payroll'
            : paymentReadyCount === totalEmployees
              ? 'Everyone can be paid'
              : `${totalEmployees - paymentReadyCount} missing payment details`,
        icon: 'wallet',
        tone: 'indigo',
        href: 'payroll',
      });
    }
    if (input.openRoles) {
      cards.push({
        key: 'open-roles',
        label: 'Open roles',
        value: input.openRoles.loading ? '—' : input.openRoles.count,
        hint: input.openRoles.loading
          ? 'Loading postings…'
          : `${input.openRoles.activeCandidates} active ${plural(input.openRoles.activeCandidates, 'candidate')}`,
        icon: 'briefcase',
        tone: 'indigo',
        href: 'recruitment',
      });
    }
    return cards;
  }

  const myBalanceDays = (input.leaveBalances ?? []).reduce((sum, item) => sum + item.remaining, 0);
  const balanceCard: DashboardKpi = {
    key: 'leave-balance',
    label: 'Leave balance',
    value: input.leaveBalances ? `${myBalanceDays}d` : '—',
    hint: input.leaveBalances
      ? `${input.leaveBalances.length} ${plural(input.leaveBalances.length, 'leave type')}`
      : 'Loading balance…',
    icon: 'palmtree',
    tone: 'success',
    href: 'leaves',
  };

  if (role === 'manager') {
    return [
      {
        key: 'team-size',
        label: 'My team',
        value: input.teamSize,
        hint: input.teamSize === 1 ? 'Direct report' : 'Direct reports',
        icon: 'users',
        tone: 'warning',
        href: 'employees',
      },
      {
        key: 'team-on-leave',
        label: 'Team on leave today',
        value: leaveValue(onLeaveToday.length),
        hint: 'Approved leave covering today',
        icon: 'calendarClock',
        tone: 'success',
        href: 'leaves',
      },
      pendingApprovals,
      balanceCard,
    ];
  }

  const cards: DashboardKpi[] = [balanceCard];
  if (input.clockIn) {
    const { clockIn } = input;
    cards.push({
      key: 'attendance-today',
      label: 'Today',
      value: clockIn.isOnLeave ? 'On leave' : clockIn.clockedInAt ? 'Clocked in' : 'Not clocked in',
      hint: clockIn.isOnLeave
        ? 'Enjoy your time off'
        : clockIn.clockedInAt
          ? `Since ${clockIn.clockedInAt}`
          : 'Clock in to start your day',
      icon: 'clock',
      tone: 'info',
      href: 'attendance',
    });
  }
  cards.push({
    key: 'my-pending',
    label: 'My pending requests',
    value: leaveValue(pending.length),
    hint: pending.length === 0 ? 'All caught up' : 'Awaiting a decision',
    icon: 'clipboardCheck',
    tone: 'warning',
    href: 'leaves',
  });
  if (input.points) {
    cards.push({
      key: 'points',
      label: 'Points balance',
      value: input.points.currentBalance,
      hint: `${input.points.monthlyReceived} received this month`,
      icon: 'gift',
      tone: 'indigo',
      href: 'shoutouts',
    });
  }
  return cards;
}

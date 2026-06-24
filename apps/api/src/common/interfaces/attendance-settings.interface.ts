export interface AttendanceSettings {
  weekends: number[];
  /** When false, members cannot clock in/out and the header control is hidden. */
  clockInEnabled?: boolean;
}

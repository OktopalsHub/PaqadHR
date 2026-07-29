export function canAccessAttendanceFeature(
  featureGatingEnabled: boolean,
  hasFeature: (feature: string) => boolean,
  attendanceFeature: string,
) {
  return !featureGatingEnabled || hasFeature(attendanceFeature);
}

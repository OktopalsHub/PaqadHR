export function canAccessAttendanceFeature<TFeature extends string>(
  featureGatingEnabled: boolean,
  hasFeature: (feature: TFeature) => boolean,
  attendanceFeature: TFeature,
): boolean {
  return !featureGatingEnabled || hasFeature(attendanceFeature);
}

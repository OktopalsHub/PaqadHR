export function getCalendarEventsQueryEnabled(params: {
  enabled?: boolean;
  tenantId?: null | string;
  tenantLoading: boolean;
}) {
  return (params.enabled ?? true) && !params.tenantLoading && Boolean(params.tenantId);
}

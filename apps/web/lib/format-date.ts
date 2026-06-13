import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export function formatDate(
  value: string | Date,
  pattern = "MMM D, YYYY",
): string {
  return dayjs(value).format(pattern);
}

export function formatDateTime(
  value: string | Date,
  pattern = "MMM D, YYYY h:mm A",
): string {
  return dayjs(value).format(pattern);
}

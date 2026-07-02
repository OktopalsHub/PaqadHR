export const PAQ_POINTS_NAME = 'Paq points';
export const PAQ_POINT_NAME = 'Paq point';

export function paqPointsLabel(count: number): string {
  return count === 1 ? PAQ_POINT_NAME : PAQ_POINTS_NAME;
}

export function formatPaqPoints(count: number): string {
  return `${count.toLocaleString()} ${paqPointsLabel(count)}`;
}

export function formatPaqPointsDelta(count: number): string {
  return `+${count.toLocaleString()} ${count === 1 ? 'Paq pt' : 'Paq pts'}`;
}

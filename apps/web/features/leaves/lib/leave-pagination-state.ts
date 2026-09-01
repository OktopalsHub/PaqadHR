export function clampLeavePage(currentPage: number, totalPages: number): number {
  return Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
}

import { navItems } from "@/features/navigations/constants/nav-items";

export type BreadcrumbSegment = {
  label: string;
  href?: string;
};

const navLabelByHref = Object.fromEntries(
  navItems.map((item) => [item.href, item.name]),
);

function labelForSegment(segment: string): string {
  const basePath = `/app/${segment}`;
  if (navLabelByHref[basePath]) return navLabelByHref[basePath];

  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getBreadcrumbs(
  pathname: string,
  tailLabel?: string | null,
): BreadcrumbSegment[] {
  if (!pathname.startsWith("/app")) {
    return [];
  }

  if (pathname === "/app") {
    return [{ label: "Dashboard" }];
  }

  const parts = pathname.split("/").filter(Boolean);
  const segments: BreadcrumbSegment[] = [{ label: "Dashboard", href: "/app" }];

  let currentPath = "/app";
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    const isDynamic = UUID_RE.test(part) || (isLast && i > 1);

    if (isDynamic) {
      if (isLast) {
        segments.push({ label: tailLabel?.trim() || "Details" });
      }
      continue;
    }

    currentPath += `/${part}`;
    segments.push({
      label: labelForSegment(part),
      href: isLast ? undefined : currentPath,
    });
  }

  return segments;
}

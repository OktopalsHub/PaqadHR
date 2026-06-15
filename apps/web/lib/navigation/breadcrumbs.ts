import { navItemDefs } from "@/features/navigations/constants/nav-items";
import {
  getTenantSlugFromPath,
  tenantRoot,
} from "@/lib/navigation/tenant-routes";

export type BreadcrumbSegment = {
  label: string;
  href?: string;
};

const navLabelBySegment = Object.fromEntries(
  navItemDefs.map((item) => [item.segment || "", item.name]),
);

function labelForSegment(segment: string): string {
  if (navLabelBySegment[segment]) return navLabelBySegment[segment];
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getBreadcrumbs(
  pathname: string,
  tailLabel?: string | null,
  workspaceLabel?: string | null,
): BreadcrumbSegment[] {
  const tenantSlug = getTenantSlugFromPath(pathname);
  if (!tenantSlug) return [];

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return [];

  const segments: BreadcrumbSegment[] = [
    {
      label: workspaceLabel?.trim() || "Workspace",
      href: tenantRoot(tenantSlug),
    },
  ];

  let currentPath = tenantRoot(tenantSlug);
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

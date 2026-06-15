"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import { useTenant } from "@/providers/tenant-provider";
import { useBreadcrumbContext } from "@/providers/breadcrumb-provider";

export function AppBreadcrumb() {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const context = useBreadcrumbContext();
  const segments = getBreadcrumbs(
    pathname,
    context?.tailLabel,
    tenant?.name,
  );

  if (segments.length === 0) return null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <Fragment key={`${segment.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {isLast || !segment.href ? (
                  <BreadcrumbPage className="truncate font-medium">
                    {segment.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={segment.href}>{segment.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

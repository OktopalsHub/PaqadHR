'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getBreadcrumbs } from '@/lib/navigation/breadcrumbs';
import { useBreadcrumbContext } from '@/providers/breadcrumb-provider';

export function AppBreadcrumb() {
  const pathname = usePathname();
  const context = useBreadcrumbContext();
  const segments = getBreadcrumbs(pathname, context?.tailLabel);
  const current = segments[segments.length - 1];

  if (segments.length === 0) return null;

  return (
    <>
      <Breadcrumb className="min-w-0 sm:hidden">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-medium">{current?.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Breadcrumb className="hidden min-w-0 sm:block">
        <BreadcrumbList>
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;

            return (
              <Fragment key={segment.href ?? segment.label}>
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
    </>
  );
}

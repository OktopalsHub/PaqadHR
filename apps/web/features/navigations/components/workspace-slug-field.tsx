'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkSlugAvailability } from '@/lib/api/onboarding';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { getAppBaseUrl, isSlugFormatValid, slugifyInput } from '@/lib/utils/slug';

type WorkspaceSlugFieldProps = {
  name: string;
  slug: string;
  onSlugChange: (slug: string) => void;
  onSlugTouched?: () => void;
};

export function WorkspaceSlugField({
  name,
  slug,
  onSlugChange,
  onSlugTouched,
}: WorkspaceSlugFieldProps) {
  const [debouncedSlug, setDebouncedSlug] = useState('');
  const [appBaseUrl, setAppBaseUrl] = useState('');
  const autoSlugRef = useRef(false);

  useEffect(() => {
    setAppBaseUrl(getAppBaseUrl());
  }, []);

  useEffect(() => {
    if (autoSlugRef.current) return;
    if (!name.trim()) {
      onSlugChange('');
      return;
    }
    onSlugChange(slugifyInput(name));
  }, [name, onSlugChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSlug(slug.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [slug]);

  const slugFormatValid = isSlugFormatValid(slug.trim());
  const debouncedSlugValid = isSlugFormatValid(debouncedSlug);

  const slugAvailabilityQuery = useQuery({
    queryKey: queryKeys.onboarding.slugAvailability(debouncedSlug),
    queryFn: () => checkSlugAvailability(debouncedSlug),
    enabled: debouncedSlug.length >= 2 && debouncedSlugValid,
    retry: false,
    staleTime: 30_000,
  });

  const slugBlocked =
    debouncedSlug.length >= 2 &&
    debouncedSlugValid &&
    slugAvailabilityQuery.isFetched &&
    slugAvailabilityQuery.data?.available === false;

  return (
    <div className="space-y-2">
      <Label htmlFor="workspace-slug">Workspace slug</Label>
      <div className="flex overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
        <span className="flex max-w-[55%] shrink-0 items-center border-r border-input bg-muted/50 px-3 text-xs text-muted-foreground sm:max-w-none sm:text-sm">
          {appBaseUrl || '…/'}
        </span>
        <Input
          id="workspace-slug"
          value={slug}
          onChange={(e) => {
            autoSlugRef.current = true;
            onSlugTouched?.();
            onSlugChange(slugifyInput(e.target.value));
          }}
          placeholder="acme-inc"
          className="border-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <p
        className={cn(
          'flex items-center gap-1.5 text-xs',
          slug.trim().length >= 2 &&
            slugAvailabilityQuery.data?.available &&
            'text-emerald-600 dark:text-emerald-400',
          slugBlocked && 'text-destructive',
        )}
      >
        {slug.trim().length < 2 ? (
          'Pick a short slug. It cannot be changed later.'
        ) : slugBlocked ? (
          <>
            <XCircle className="size-3.5" /> Slug is taken
          </>
        ) : slugAvailabilityQuery.data?.available ? (
          <>
            <CheckCircle2 className="size-3.5" /> Slug is available
          </>
        ) : (
          'Checking availability…'
        )}
      </p>
    </div>
  );
}

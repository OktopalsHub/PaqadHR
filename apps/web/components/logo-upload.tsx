'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { OrgAvatar } from '@/components/org-avatar';
import { Button } from '@/components/ui/button';
import { IMAGE_ACCEPT, isAcceptedImageFile } from '@/lib/api/files';
import { cn } from '@/lib/utils';

type LogoUploadProps = {
  src?: string | null;
  name: string;
  disabled?: boolean;
  onUpload: (file: File) => Promise<string | undefined>;
  onError?: (message: string) => void;
};

export function LogoUpload({ src, name, disabled = false, onUpload, onError }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (src) {
      setPreviewUrl(null);
    }
  }, [src]);

  const displaySrc = previewUrl ?? src ?? undefined;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!isAcceptedImageFile(file)) {
      onError?.('Choose a JPEG, PNG, WebP, or GIF image');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);

    try {
      const nextUrl = await onUpload(file);
      if (typeof nextUrl === 'string') {
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(nextUrl);
      }
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
      onError?.(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <OrgAvatar
        src={displaySrc}
        name={name || 'Workspace'}
        className={cn(
          'size-24 rounded-[8px] border border-[#d7e3f6] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950/70',
        )}
        fallbackClassName="bg-white text-slate-500 dark:bg-slate-950 dark:text-slate-300"
        iconFallback={!displaySrc}
      />

      <div className="space-y-2">
        <p className="text-[28px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          {name || 'Workspace'}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload a square logo to keep branding consistent across the workspace.
        </p>
        {!disabled ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Camera className="mr-1.5 size-4" />
              )}
              {displaySrc ? 'Change logo' : 'Upload logo'}
            </Button>
          </>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Only admins can change the workspace logo.
          </p>
        )}
      </div>
    </div>
  );
}

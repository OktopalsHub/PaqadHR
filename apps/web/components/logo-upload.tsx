'use client';

import { Building2, Camera, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { IMAGE_ACCEPT, isAcceptedImageFile } from '@/lib/api/files';
import { cn } from '@/lib/utils';

type LogoUploadProps = {
  src?: string | null;
  name: string;
  disabled?: boolean;
  onUpload: (file: File) => Promise<string | void>;
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
    <div className="flex items-center gap-4">
      <div
        className={cn(
          'relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40',
        )}
      >
        {displaySrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displaySrc} alt={`${name} logo`} className="size-full object-cover" />
        ) : (
          <Building2 className="size-8 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{name || 'Workspace'}</p>
        <p className="text-xs text-muted-foreground">Square logo, at least 128×128px recommended.</p>
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
          <p className="text-xs text-muted-foreground">Only admins can change the workspace logo.</p>
        )}
      </div>
    </div>
  );
}

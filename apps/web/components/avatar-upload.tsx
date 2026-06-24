'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IMAGE_ACCEPT, isAcceptedImageFile } from '@/lib/api/files';
import { cn } from '@/lib/utils';

type AvatarUploadProps = {
  src?: string | null;
  alt: string;
  fallback: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onUpload: (file: File) => Promise<string | void>;
  onError?: (message: string) => void;
};

const sizeClasses = {
  sm: 'size-20',
  md: 'size-32',
  lg: 'size-40',
};

const fallbackTextClasses = {
  sm: 'text-lg',
  md: 'text-4xl',
  lg: 'text-5xl',
};

export function AvatarUpload({
  src,
  alt,
  fallback,
  disabled = false,
  size = 'md',
  onUpload,
  onError,
}: AvatarUploadProps) {
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
    <div className="relative inline-flex">
      <Avatar className={cn(sizeClasses[size])}>
        <AvatarImage src={displaySrc} alt={alt} />
        <AvatarFallback className={fallbackTextClasses[size]}>{fallback}</AvatarFallback>
      </Avatar>

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
            size="icon"
            variant="secondary"
            className="absolute -bottom-1 -right-1 size-9 rounded-full shadow-md"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            <span className="sr-only">Upload photo</span>
          </Button>
        </>
      ) : null}
    </div>
  );
}

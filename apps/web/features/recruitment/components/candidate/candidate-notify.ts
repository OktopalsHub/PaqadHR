import { toast } from 'sonner';

export function notifyError(error: unknown, fallback = 'Something went wrong') {
  toast.error(error instanceof Error ? error.message : fallback);
}

'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type EmployeeWorkspaceStatusProps = {
  displayName: string;
  isActive: boolean;
  isPending: boolean;
  onConfirm: (isActive: boolean) => void;
};

export function EmployeeWorkspaceStatus({
  displayName,
  isActive,
  isPending,
  onConfirm,
}: EmployeeWorkspaceStatusProps) {
  const actionLabel = isActive ? 'Deactivate member' : 'Reactivate member';
  const title = isActive ? 'Deactivate workspace access?' : 'Reactivate workspace access?';
  const description = isActive
    ? `${displayName} will lose access to this workspace. Their record stays in the directory as inactive.`
    : `${displayName} will be able to sign in and use this workspace again.`;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={isActive ? 'destructive' : 'default'}
          className="w-full"
          disabled={isPending}
        >
          {isPending ? 'Updating…' : actionLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              isActive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
            onClick={() => onConfirm(!isActive)}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FileCode,
  FileText,
  Heart,
  Loader2,
  MessageSquare,
  Plus,
  Repeat,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { type ComponentType, useState } from 'react';
import { toast } from 'sonner';
import { SlackIcon } from '@/components/icons/slack-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAssignPoints } from '@/hooks/queries/use-rewards';
import { useMembersPoints } from '@/hooks/queries/use-tenant-settings';
import { apiClient, tenantPath } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

type Task = {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: string;
  category?: string;
  completed: boolean;
  imageUrl?: string;
  submissionType: 'instant' | 'text' | 'file';
  isRecurring: boolean;
  status: 'available' | 'pending' | 'completed' | 'rejected';
  submissionText?: string;
  submissionFileName?: string;
  submissionId?: string;
};

type PendingSubmission = {
  id: string;
  submissionId: string;
  title: string;
  description: string;
  points: number;
  icon: string;
  category?: string;
  imageUrl?: string;
  submissionType: 'instant' | 'text' | 'file';
  status: 'pending' | 'completed' | 'rejected';
  submissionText?: string;
  submissionFileName?: string;
  memberId: string;
  member?: {
    firstName: string | null;
    lastName: string | null;
  };
};

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Compass,
  User,
  Heart,
  Award,
  Slack: SlackIcon,
  Sparkles,
  Activity,
  MessageSquare,
};

export function ShoutoutTasksTab() {
  const queryClient = useQueryClient();
  const { tenant, tenantId } = useTenant();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['shoutout-tasks', tenantId],
    queryFn: () => apiClient<Task[]>(tenantPath(tenantId ?? '', 'rewards/tasks')),
    enabled: Boolean(tenantId),
  });

  const { data: pendingSubmissions = [] } = useQuery<PendingSubmission[]>({
    queryKey: ['shoutout-tasks-pending', tenantId],
    queryFn: () =>
      apiClient<PendingSubmission[]>(
        tenantPath(tenantId ?? '', 'rewards/tasks/submissions/pending'),
      ),
    // All authenticated users can call this — the backend filters to only return
    // submissions they are allowed to approve (admin/owner/manager of submitter)
    enabled: Boolean(tenantId),
  });

  const { data: members = [] } = useMembersPoints();
  const assignPointsMutation = useAssignPoints();

  const [isAdding, setIsAdding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPoints, setNewPoints] = useState('15');
  const [newCategory, setNewCategory] = useState('');
  const [newIcon, setNewIcon] = useState('Sparkles');
  const [newSubmissionType, setNewSubmissionType] = useState<'instant' | 'text' | 'file'>(
    'instant',
  );
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newIsRecurring, setNewIsRecurring] = useState(false);

  // Direct Point Assignment State
  const [isAssigningPoints, setIsAssigningPoints] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [assignments, setAssignments] = useState<{ memberId: string; points: number }[]>([]);
  const [assignPointsAmount, setAssignPointsAmount] = useState('50');
  const [assignReason, setAssignReason] = useState('');

  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isMutatingSubmission, setIsMutatingSubmission] = useState(false);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;
  const percentCompleted = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const pointsEarned = tasks
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + t.points, 0);

  const handleCompleteInstant = async (taskId: string, _title: string, reward: number) => {
    try {
      const res = await apiClient<{ success: boolean; status: string }>(
        tenantPath(tenantId ?? '', `rewards/tasks/${taskId}/submit`),
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      if (res.success) {
        toast.success(`Task completed! You earned +${reward} points! 🎉`);
        invalidateAll();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  const handleStartSubmission = (task: Task) => {
    setSubmittingTask(task);
    setSubmissionText('');
    setSelectedFileName('');
    setUploadProgress(0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      setIsUploadingFile(true);
      setUploadProgress(10);

      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsUploadingFile(false);
            return 100;
          }
          return prev + 30;
        });
      }, 200);
    }
  };

  const handleSubmitVerification = async () => {
    if (!submittingTask) return;

    if (submittingTask.submissionType === 'text' && !submissionText.trim()) {
      toast.error('Please enter your submission text');
      return;
    }

    if (submittingTask.submissionType === 'file' && !selectedFileName) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsMutatingSubmission(true);
    try {
      const res = await apiClient<{ success: boolean; status: string }>(
        tenantPath(tenantId ?? '', `rewards/tasks/${submittingTask.id}/submit`),
        {
          method: 'POST',
          body: JSON.stringify({
            submissionText: submissionText.trim() || undefined,
            submissionFileName: selectedFileName || undefined,
          }),
        },
      );
      if (res.success) {
        toast.success('Submission sent for admin review! 🚀');
        setSubmittingTask(null);
        invalidateAll();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit verification');
    } finally {
      setIsMutatingSubmission(false);
    }
  };

  const handleApproveSubmission = async (
    taskId: string,
    submissionId: string,
    title: string,
    reward: number,
  ) => {
    try {
      const res = await apiClient<{ success: boolean }>(
        tenantPath(tenantId ?? '', `rewards/tasks/${taskId}/submissions/${submissionId}/approve`),
        {
          method: 'POST',
        },
      );
      if (res.success) {
        toast.success(`Approved! +${reward} points awarded to employee for "${title}".`);
        invalidateAll();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve submission');
    }
  };

  const handleRejectSubmission = async (taskId: string, submissionId: string, title: string) => {
    try {
      const res = await apiClient<{ success: boolean }>(
        tenantPath(tenantId ?? '', `rewards/tasks/${taskId}/submissions/${submissionId}/reject`),
        {
          method: 'POST',
        },
      );
      if (res.success) {
        toast.error(`Submission for "${title}" has been rejected. Resubmission enabled.`);
        invalidateAll();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject submission');
    }
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) {
      toast.error('Task title is required');
      return;
    }
    setIsCreating(true);
    try {
      await apiClient(tenantPath(tenantId ?? '', 'rewards/tasks'), {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || 'Complete this task to earn points.',
          points: Number(newPoints) || 15,
          icon: newIcon,
          category: newCategory.trim() || undefined,
          imageUrl: newImageUrl.trim() || undefined,
          submissionType: newSubmissionType,
          isRecurring: newIsRecurring,
        }),
      });
      setNewTitle('');
      setNewDesc('');
      setNewCategory('');
      setNewImageUrl('');
      setNewSubmissionType('instant');
      setNewIsRecurring(false);
      setIsAdding(false);
      toast.success(`Task created successfully!`);
      invalidateAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiClient(tenantPath(tenantId ?? '', `rewards/tasks/${taskId}`), {
        method: 'DELETE',
      });
      toast.success('Task removed from checklist.');
      invalidateAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleDirectAssignPoints = async () => {
    if (assignments.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    try {
      await assignPointsMutation.mutateAsync({
        memberIds: assignments.map((a) => a.memberId),
        points: Number(assignPointsAmount) || 0,
        reason: assignReason.trim() || undefined,
        assignments: assignments,
      });
      toast.success(`Successfully assigned points to ${assignments.length} users!`);
      setIsAssigningPoints(false);
      setAssignments([]);
      setAssignReason('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign points');
    }
  };

  const addAssignment = (memberId: string) => {
    if (assignments.some((a) => a.memberId === memberId)) return;
    setAssignments([...assignments, { memberId, points: Number(assignPointsAmount) || 50 }]);
    setAssignSearch('');
  };

  const removeAssignment = (memberId: string) => {
    setAssignments(assignments.filter((a) => a.memberId !== memberId));
  };

  const updateAssignmentPoints = (memberId: string, valStr: string) => {
    const pts = Math.max(0, parseInt(valStr, 10) || 0);
    setAssignments(assignments.map((a) => (a.memberId === memberId ? { ...a, points: pts } : a)));
  };

  const selectAllMembers = () => {
    const currentVal = Number(assignPointsAmount) || 50;
    setAssignments(members.map((m) => ({ memberId: m.memberId, points: currentVal })));
  };

  const deselectAllMembers = () => {
    setAssignments([]);
  };

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['shoutout-tasks', tenantId] });
    void queryClient.invalidateQueries({ queryKey: ['shoutout-tasks-pending', tenantId] });
    if (tenantId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoutouts.points(tenantId) });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.settings.membersPoints, tenantId],
      });
    }
  };

  const userPendingTasks = tasks.filter((t) => t.status === 'pending');
  const availableTasks = tasks.filter((t) => t.status === 'available' || t.status === 'rejected');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  if (tasksLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="size-8 text-indigo-600 animate-spin" />
        <p className="text-sm text-muted-foreground font-semibold">Loading points checklist...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 size-48 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 size-48 rounded-full bg-purple-500/5 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Trophy className="size-6 text-amber-500 animate-pulse fill-amber-500/15" />
              Points Checklist
            </h3>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Accelerate your point earnings! Complete actions, upload proof if required, and watch
              your balance grow to redeem premium digital cards and custom rewards.
            </p>
          </div>

          <div className="flex items-center gap-6 shrink-0 bg-background/50 backdrop-blur-md p-5 rounded-2xl border border-border/60 shadow-inner">
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                Tasks Completed
              </p>
              <p className="text-3xl font-extrabold text-foreground mt-1">
                {completedCount}{' '}
                <span className="text-base font-normal text-muted-foreground">/ {totalCount}</span>
              </p>
            </div>
            <div className="h-10 w-px bg-border/80" />
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest font-sans">
                Points Earned
              </p>
              <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center justify-center gap-1.5">
                <Sparkles className="size-5 text-amber-500 fill-amber-500/15" />
                {pointsEarned}
              </p>
            </div>
          </div>
        </div>

        {totalCount > 0 && (
          <div className="mt-8 space-y-2.5">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
              <span>Progress Bar</span>
              <span>{percentCompleted}% Completed</span>
            </div>
            <Progress value={percentCompleted} className="h-2.5 bg-muted/60" />
          </div>
        )}
      </div>

      {/* Admin Checklist Management Panel */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between border-b pb-4 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Checklist Management</h4>
            <p className="text-xs text-muted-foreground">
              Configure checklist challenges, approve submissions, or award tokens directly to
              members.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAssigningPoints(true)}
              className="gap-1.5 text-xs font-bold border-indigo-100 hover:border-indigo-200 text-indigo-600 dark:border-indigo-950 dark:text-indigo-400 rounded-xl"
            >
              <Users className="size-4" />
              Direct Assign Points
            </Button>
            {!isAdding && (
              <Button
                size="sm"
                onClick={() => setIsAdding(true)}
                className="gap-1.5 text-xs font-bold shadow-sm rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="size-4" />
                Add Custom Task
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Add Custom Task Form */}
      {isAdmin && isAdding && (
        <Card className="border border-indigo-100 dark:border-indigo-950 bg-indigo-50/10 dark:bg-indigo-950/5 shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="size-4" />
                Create New Task
              </h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAdding(false)}
                className="size-8 p-0 rounded-full"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Task Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Daily Step Challenge"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Points Reward</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={newPoints}
                  onChange={(e) => setNewPoints(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category (Optional)</Label>
                <Input
                  placeholder="e.g. Health, Social"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Submission Verification Mode</Label>
                <Select
                  value={newSubmissionType}
                  onValueChange={(v) => setNewSubmissionType(v as Task['submissionType'])}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant (No verification required)</SelectItem>
                    <SelectItem value="text">Text Response (Provide text/links)</SelectItem>
                    <SelectItem value="file">File/Screenshot Upload (Upload PNG/PDF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Icon</Label>
                <Select value={newIcon} onValueChange={setNewIcon}>
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sparkles">Sparkles (General)</SelectItem>
                    <SelectItem value="Compass">Compass (Onboarding)</SelectItem>
                    <SelectItem value="User">User (Profile)</SelectItem>
                    <SelectItem value="Heart">Heart (Appreciation)</SelectItem>
                    <SelectItem value="Award">Award (Achievement)</SelectItem>
                    <SelectItem value="Activity">Activity (Challenge)</SelectItem>
                    <SelectItem value="MessageSquare">Message (Feedback)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Custom Image / Thumbnail URL (Optional)
                </Label>
                <Input
                  placeholder="https://example.com/image.png"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Recurring Challenge
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Enable if employees can complete this challenge multiple times (e.g.
                    daily/weekly)
                  </p>
                </div>
                <Switch
                  checked={newIsRecurring}
                  onCheckedChange={setNewIsRecurring}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                <Label className="text-xs font-semibold">Instructions / Description</Label>
                <Textarea
                  placeholder="Provide details on what they need to complete or submit."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="h-10 text-xs font-semibold rounded-xl"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isCreating}
                className="h-10 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 rounded-xl"
                onClick={handleCreateTask}
              >
                {isCreating && <Loader2 className="size-3 animate-spin" />}
                Create Task
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submissions Pending Review — visible to anyone the backend returns items for (admin/owner/manager) */}
      {pendingSubmissions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-bold text-sm">
            <Clock className="size-4 animate-spin" />
            <span>Submissions Pending Review ({pendingSubmissions.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingSubmissions.map((sub) => (
              <Card
                key={sub.submissionId}
                className="border-amber-200 bg-amber-50/5 dark:border-amber-900/40 shadow-sm relative overflow-hidden rounded-2xl"
              >
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl">
                  Needs Approval
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    {sub.imageUrl ? (
                      <Image
                        src={sub.imageUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="size-11 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center border border-amber-200/50 shrink-0">
                        <FileText className="size-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{sub.title}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-600 border-amber-200"
                        >
                          +{sub.points} pts
                        </Badge>
                        {sub.category && (
                          <Badge variant="secondary" className="text-[10px]">
                            {sub.category}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground font-medium">
                          by {sub.member?.firstName} {sub.member?.lastName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submission Detail Block */}
                  <div className="rounded-lg bg-muted/50 p-3 text-xs border border-border/40 space-y-2">
                    <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                      Submitted Proof:
                    </p>
                    {sub.submissionType === 'text' && (
                      <p className="text-foreground italic leading-normal">
                        "{sub.submissionText}"
                      </p>
                    )}
                    {sub.submissionType === 'file' && (
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                        <FileCode className="size-4" />
                        <span>{sub.submissionFileName}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/20 rounded-lg"
                      onClick={() => handleRejectSubmission(sub.id, sub.submissionId, sub.title)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs font-bold bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 rounded-lg"
                      onClick={() =>
                        handleApproveSubmission(sub.id, sub.submissionId, sub.title, sub.points)
                      }
                    >
                      <Check className="size-3.5" />
                      Approve & Pay
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Main Checklist View */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Side: Available Tasks */}
        <div className="xl:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-indigo-500" />
              Available Checklist ({availableTasks.length})
            </h4>
          </div>

          {availableTasks.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <CheckCircle2 className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">
                You have completed all available checklist tasks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {availableTasks.map((task) => {
                const IconComponent = ICON_MAP[task.icon] || Sparkles;
                return (
                  <Card
                    key={task.id}
                    className="group transition-all duration-300 border-border/70 hover:border-indigo-500/20 hover:shadow-md dark:hover:bg-muted/10 rounded-2xl"
                  >
                    <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {task.imageUrl ? (
                          <div className="relative size-12 rounded-xl overflow-hidden border border-border/80 group-hover:scale-105 transition-transform shrink-0">
                            <Image
                              src={task.imageUrl}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="size-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-100 dark:border-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <IconComponent className="size-5" />
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="font-bold text-sm text-foreground leading-none">
                              {task.title}
                            </h4>
                            {task.category && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] font-medium py-px px-1.5 bg-muted"
                              >
                                {task.category}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[9px] font-extrabold py-px px-1.5 border-amber-200/60 bg-amber-500/5 text-amber-600 dark:border-amber-900/30"
                            >
                              +{task.points} Points
                            </Badge>
                            {task.isRecurring && (
                              <Badge
                                variant="outline"
                                className="text-[9px] font-bold py-px px-1.5 border-indigo-200 bg-indigo-500/5 text-indigo-600 dark:border-indigo-900/30 flex items-center gap-0.5"
                              >
                                <Repeat className="size-2.5" />
                                Recurring
                              </Badge>
                            )}
                            {task.status === 'rejected' && (
                              <Badge variant="destructive" className="text-[9px] py-px px-1.5">
                                Rejected / Resubmit
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed pr-2">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5">
                            <span className="font-semibold text-[9px] uppercase tracking-wider text-indigo-500">
                              {task.submissionType === 'instant' && '⚡ Instant Claim'}
                              {task.submissionType === 'text' && '✍️ Text Verification'}
                              {task.submissionType === 'file' && '📎 File Submission'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                          onClick={() => {
                            if (task.submissionType === 'instant') {
                              handleCompleteInstant(task.id, task.title, task.points);
                            } else {
                              handleStartSubmission(task);
                            }
                          }}
                        >
                          Complete Task
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Pending User review & Completed Checklist */}
        <div className="xl:col-span-4 space-y-6">
          {userPendingTasks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Clock className="size-4 text-amber-500" />
                Under Admin Review ({userPendingTasks.length})
              </h4>
              <div className="space-y-2">
                {userPendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-amber-200/60 bg-amber-500/5 p-4 space-y-2 relative overflow-hidden"
                  >
                    <h5 className="font-bold text-xs text-foreground pr-10">{task.title}</h5>
                    <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">
                      Pending review (+{task.points} pts)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-green-500" />
              Completed History ({completedTasks.length})
            </h4>

            {completedTasks.length === 0 ? (
              <div className="text-center p-6 rounded-2xl border border-dashed border-border bg-muted/5 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">
                  No completed tasks yet. Get started on the available checklist!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-green-200/50 bg-green-500/5 text-xs transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center border border-green-200/30 shrink-0">
                        <Check className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">{task.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Claimed successfully
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-600 hover:bg-green-600 text-white font-bold text-[10px] rounded-full">
                      +{task.points} Pts
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Submission Verification Modal */}
      <Dialog open={!!submittingTask} onOpenChange={(open) => !open && setSubmittingTask(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              {submittingTask?.submissionType === 'text'
                ? 'Provide Response'
                : 'Upload Screenshot Proof'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              This task requires verification before points can be awarded. Please provide the
              requested details below.
            </DialogDescription>
          </DialogHeader>

          {submittingTask && (
            <div className="space-y-4 py-3">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/40">
                <AlertCircle className="size-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-foreground">{submittingTask.title}</p>
                  <p className="text-muted-foreground mt-0.5">{submittingTask.description}</p>
                </div>
              </div>

              {submittingTask.submissionType === 'text' ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Response Details <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="Enter link, text description, or details confirming completion..."
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    rows={4}
                    className="text-xs resize-none rounded-xl"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold">
                    Upload Screenshot / Document <span className="text-destructive">*</span>
                  </Label>

                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/75 rounded-2xl p-6 bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="size-8 text-muted-foreground mb-2" />
                    <span className="text-xs font-semibold text-foreground">
                      Click to browse file
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      Accepts PNG, JPG, or PDF (max 5MB)
                    </span>
                  </div>

                  {selectedFileName && (
                    <div className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/10 dark:bg-indigo-950/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold min-w-0">
                        <FileCode className="size-4 shrink-0" />
                        <span className="truncate">{selectedFileName}</span>
                      </div>
                      {isUploadingFile ? (
                        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                          <Loader2 className="size-3 animate-spin text-indigo-500" />
                          <span>Uploading...</span>
                        </div>
                      ) : (
                        <span className="text-green-600 dark:text-green-400 font-bold shrink-0">
                          Ready
                        </span>
                      )}
                    </div>
                  )}

                  {isUploadingFile && <Progress value={uploadProgress} className="h-1 bg-muted" />}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSubmittingTask(null)}
              className="h-10 text-xs font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                isUploadingFile ||
                isMutatingSubmission ||
                (submittingTask?.submissionType === 'text' && !submissionText.trim()) ||
                (submittingTask?.submissionType === 'file' && !selectedFileName)
              }
              onClick={handleSubmitVerification}
              className="h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 rounded-xl"
            >
              {isMutatingSubmission && <Loader2 className="size-3 animate-spin" />}
              Submit Proof
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Direct Point Assignment Modal */}
      <Dialog open={isAssigningPoints} onOpenChange={setIsAssigningPoints}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Users className="size-5 text-indigo-600" />
              Direct Points Assignment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select members and specify the exact points you want to award each of them.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            {/* Search and Select Recipients */}
            <div className="space-y-1.5 relative">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                1. Add Recipient(s)
              </Label>
              <div className="relative">
                <Input
                  placeholder="Type name to search and select members..."
                  value={assignSearch}
                  onChange={(e) => {
                    setAssignSearch(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="h-9 text-xs rounded-xl"
                />

                {/* Search Results Dropdown */}
                {isSearchFocused && (
                  <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-xl shadow-lg max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {members
                      .filter((m) => {
                        if (assignments.some((a) => a.memberId === m.memberId)) return false;
                        const fullName = `${m.firstName ?? ''} ${m.lastName ?? ''}`.toLowerCase();
                        return fullName.includes(assignSearch.toLowerCase());
                      })
                      .map((m) => (
                        <button
                          key={m.memberId}
                          type="button"
                          onClick={() => addAssignment(m.memberId)}
                          className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors flex items-center justify-between"
                        >
                          <span>
                            {m.firstName} {m.lastName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {m.currentBalance} pts
                          </span>
                        </button>
                      ))}
                    {members.filter((m) => {
                      if (assignments.some((a) => a.memberId === m.memberId)) return false;
                      const fullName = `${m.firstName ?? ''} ${m.lastName ?? ''}`.toLowerCase();
                      return fullName.includes(assignSearch.toLowerCase());
                    }).length === 0 && (
                      <div className="text-center py-3 text-xs text-muted-foreground">
                        No members available
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-between items-center text-[10px] font-bold mt-1">
                <span className="text-muted-foreground">Default points for new additions:</span>
                <div className="flex gap-2 text-indigo-600 dark:text-indigo-400">
                  <button type="button" onClick={selectAllMembers} className="hover:underline">
                    Add All Members
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button type="button" onClick={deselectAllMembers} className="hover:underline">
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Default Points Config */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                Default Point Value
              </Label>
              <Input
                type="number"
                value={assignPointsAmount}
                onChange={(e) => setAssignPointsAmount(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Selected Recipients list with custom points inputs */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase flex justify-between">
                <span>Selected Recipients</span>
                <span className="text-[10px] lowercase font-normal">
                  ({assignments.length} selected)
                </span>
              </Label>
              <div className="border rounded-xl max-h-56 overflow-y-auto p-3 bg-muted/20 space-y-2">
                {assignments.map((item) => {
                  const member = members.find((m) => m.memberId === item.memberId);
                  if (!member) return null;
                  return (
                    <div
                      key={item.memberId}
                      className="flex items-center justify-between p-2 rounded-xl bg-background border border-border"
                    >
                      <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                        {member.firstName} {member.lastName}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={item.points}
                            onChange={(e) => updateAssignmentPoints(item.memberId, e.target.value)}
                            className="w-16 h-8 text-center text-xs font-bold rounded-lg px-1"
                          />
                          <span className="text-[10px] font-bold text-muted-foreground">pts</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAssignment(item.memberId)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {assignments.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No recipients selected. Search and select above.
                  </div>
                )}
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                Reason / Description
              </Label>
              <Textarea
                placeholder="Provide a reason for the assignment (e.g. Excellent teamwork, event participation)..."
                value={assignReason}
                onChange={(e) => setAssignReason(e.target.value)}
                rows={2}
                className="text-xs rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-end gap-2 shrink-0 border-t pt-3 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAssigningPoints(false)}
              className="h-10 text-xs font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={assignments.length === 0 || assignPointsMutation.isPending}
              onClick={handleDirectAssignPoints}
              className="h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 rounded-xl px-4"
            >
              <Send className="size-3.5" />
              {assignPointsMutation.isPending ? 'Assigning...' : 'Assign Points'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Heart, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingBlock } from "@/components/loading-block";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEmployees } from "@/hooks/queries/use-employees";
import {
  useCreateShoutout,
  useShoutoutCategories,
  useShoutouts,
} from "@/hooks/queries/use-shoutouts";
import type { Shoutout } from "@/lib/schemas/shoutout";
import { formatDateTime } from "@/lib/format-date";

function memberName(member: {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
}) {
  return (
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.preferredName ||
    "Team member"
  );
}

function ShoutoutCard({ shoutout }: { shoutout: Shoutout }) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            {memberName(shoutout.sender)} →{" "}
            {shoutout.recipients.map((r) => memberName(r)).join(", ")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {shoutout.message}
          </p>
        </div>
        <span className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium">
          +{shoutout.totalPoints} pts
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {formatDateTime(shoutout.createdAt)}
      </p>
    </article>
  );
}

export function ShoutoutsPage() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [points, setPoints] = useState("10");
  const [recipientId, setRecipientId] = useState("");

  const { data: employees = [] } = useEmployees();
  const { data: categories = [] } = useShoutoutCategories();
  const { data, isLoading, isError, error } = useShoutouts();
  const createShoutout = useCreateShoutout();

  const items =
    data?.records ?? data?.shoutouts ?? data?.data ?? data?.items ?? [];

  const handleCreate = async () => {
    if (!recipientId || !message.trim()) {
      toast.error("Select a recipient and write a message");
      return;
    }
    try {
      await createShoutout.mutateAsync({
        recipientIds: [recipientId],
        pointsPerRecipient: Number(points) || 10,
        message: message.trim(),
        categoryIds: categories[0] ? [categories[0].id] : undefined,
      });
      setOpen(false);
      setMessage("");
      setRecipientId("");
      toast.success("Shoutout sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    }
  };

  if (isLoading) return <LoadingBlock />;

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load shoutouts</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Something went wrong"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shoutouts"
        description="Recognize teammates with points and public appreciation."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="mr-2 size-4" />
                New shoutout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send a shoutout</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Select value={recipientId} onValueChange={setRecipientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose teammate" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input
                    type="number"
                    min={1}
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    rows={4}
                    placeholder="Thanks for going above and beyond..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={createShoutout.isPending}
                  onClick={handleCreate}
                >
                  Send shoutout
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No shoutouts yet"
          description="Be the first to recognize someone on your team."
        />
      ) : (
        <div className="space-y-4">
          {items.map((shoutout) => (
            <ShoutoutCard key={shoutout.id} shoutout={shoutout} />
          ))}
        </div>
      )}
    </div>
  );
}

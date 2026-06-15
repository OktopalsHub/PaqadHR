"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCandidate,
  useJobOpenings,
} from "@/hooks/queries/use-recruitment";
import type { CandidateSource } from "@/lib/schemas/recruitment";

const SOURCE_OPTIONS: { value: CandidateSource; label: string }[] = [
  { value: "INTERNAL", label: "Referral / internal" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "INDEED", label: "Indeed" },
  { value: "PUBLIC_WEBSITE", label: "Job board / website" },
  { value: "OTHER", label: "Other" },
];

type AddCandidateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddCandidateDialog({
  open,
  onOpenChange,
}: AddCandidateDialogProps) {
  const createCandidate = useCreateCandidate();
  const { data: jobsData } = useJobOpenings();
  const jobs = jobsData?.jobs ?? [];

  const [jobOpeningId, setJobOpeningId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState("");
  const [source, setSource] = useState<CandidateSource>("OTHER");

  const reset = () => {
    setJobOpeningId("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setSkills("");
    setSource("OTHER");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!jobOpeningId) {
      toast.error("Select a job posting for this candidate.");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("First name, last name, and email are required.");
      return;
    }

    try {
      await createCandidate.mutateAsync({
        jobOpeningId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        skills: skills.trim() || undefined,
        source,
      });
      toast.success("Candidate added to the role.");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add candidate",
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>
            Add an external applicant to a job posting in your workspace.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Job posting</Label>
            <Select value={jobOpeningId} onValueChange={setJobOpeningId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {jobs.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No job postings yet
                  </SelectItem>
                ) : (
                  jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="candidate-first-name">First name</Label>
              <Input
                id="candidate-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate-last-name">Last name</Label>
              <Input
                id="candidate-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="candidate-email">Email</Label>
            <Input
              id="candidate-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="candidate-phone">Phone (optional)</Label>
            <Input
              id="candidate-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="candidate-skills">Skills / notes (optional)</Label>
            <Textarea
              id="candidate-skills"
              rows={3}
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="React, Node.js, 5 years experience…"
            />
          </div>

          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={source}
              onValueChange={(value) => setSource(value as CandidateSource)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCandidate.isPending || jobs.length === 0}
            >
              {createCandidate.isPending ? "Adding…" : "Add candidate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

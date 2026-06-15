"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { useCreateJobOpening } from "@/hooks/queries/use-recruitment";
import { cn } from "@/lib/utils";

const STEPS = ["Basics", "Details", "Publish"] as const;

const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "TEMPORARY", label: "Temporary" },
] as const;

const EXPERIENCE_LEVELS = [
  "Entry Level",
  "Junior",
  "Mid-Level",
  "Senior",
  "Lead",
  "Executive",
];

const LOCATION_TYPES = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "On-site" },
] as const;

function linesToArray(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

type CreateJobDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateJobDialog({
  open,
  onOpenChange: setOpen,
}: CreateJobDialogProps) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [position, setPosition] = useState("");
  const [employmentType, setEmploymentType] = useState<string>("FULL_TIME");
  const [experienceLevel, setExperienceLevel] = useState("Mid-Level");
  const [description, setDescription] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  const [responsibilitiesText, setResponsibilitiesText] = useState("");
  const [locationType, setLocationType] = useState<string>("REMOTE");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [numberOfOpenings, setNumberOfOpenings] = useState("1");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [publish, setPublish] = useState(true);

  const createJob = useCreateJobOpening();

  const resetForm = () => {
    setStep(0);
    setTitle("");
    setPosition("");
    setEmploymentType("FULL_TIME");
    setExperienceLevel("Mid-Level");
    setDescription("");
    setRequirementsText("");
    setResponsibilitiesText("");
    setLocationType("REMOTE");
    setCity("");
    setCountry("");
    setNumberOfOpenings("1");
    setApplicationDeadline("");
    setIsUrgent(false);
    setPublish(true);
  };

  const canContinue =
    step === 0
      ? title.trim().length >= 2 && position.trim().length >= 1
      : step === 1
        ? description.trim().length >= 10 &&
          linesToArray(requirementsText).length >= 1
        : true;

  const handleSubmit = async () => {
    try {
      await createJob.mutateAsync({
        title: title.trim(),
        position: position.trim(),
        employmentType: employmentType as "FULL_TIME",
        experienceLevel,
        location: {
          type: locationType as "REMOTE",
          city: city.trim() || undefined,
          country: country.trim() || undefined,
        },
        description: description.trim(),
        requirements: linesToArray(requirementsText),
        responsibilities: linesToArray(responsibilitiesText),
        numberOfOpenings: Number(numberOfOpenings) || 1,
        applicationDeadline: applicationDeadline
          ? new Date(applicationDeadline).toISOString()
          : undefined,
        isUrgent,
        publish,
      });
      toast.success(publish ? "Role published" : "Draft saved");
      setOpen(false);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create role",
      );
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    void handleSubmit();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create job opening</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium",
                  index <= step
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground",
                )}
              >
                {index + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:inline",
                  index <= step
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {index < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "h-px w-4",
                    index < step ? "bg-foreground" : "bg-border",
                  )}
                />
              ) : null}
            </div>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="job-title">Job title</Label>
              <Input
                id="job-title"
                placeholder="Senior Product Designer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-position">Position</Label>
              <Input
                id="job-position"
                placeholder="Product Designer"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employment type</Label>
                <Select
                  value={employmentType}
                  onValueChange={setEmploymentType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Experience level</Label>
                <Select
                  value={experienceLevel}
                  onValueChange={setExperienceLevel}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="job-description">Description</Label>
              <Textarea
                id="job-description"
                rows={5}
                placeholder="What does this role involve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-requirements">Requirements</Label>
              <Textarea
                id="job-requirements"
                rows={4}
                placeholder="One requirement per line"
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-responsibilities">
                Responsibilities{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="job-responsibilities"
                rows={3}
                placeholder="One responsibility per line"
                value={responsibilitiesText}
                onChange={(e) => setResponsibilitiesText(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Location type</Label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-city">City</Label>
                <Input
                  id="job-city"
                  placeholder="Lagos"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-country">Country</Label>
                <Input
                  id="job-country"
                  placeholder="Nigeria"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-openings">Openings</Label>
                <Input
                  id="job-openings"
                  type="number"
                  min={1}
                  value={numberOfOpenings}
                  onChange={(e) => setNumberOfOpenings(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-deadline">Application deadline</Label>
                <Input
                  id="job-deadline"
                  type="date"
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="job-urgent"
                checked={isUrgent}
                onCheckedChange={(checked) => setIsUrgent(checked === true)}
              />
              <Label htmlFor="job-urgent" className="font-normal">
                Mark as urgent hiring
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="job-publish"
                checked={publish}
                onCheckedChange={(checked) => setPublish(checked === true)}
              />
              <Label htmlFor="job-publish" className="font-normal">
                Publish immediately (otherwise save as draft)
              </Label>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || createJob.isPending}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          <Button
            type="button"
            disabled={!canContinue || createJob.isPending}
            onClick={handleNext}
          >
            {step === STEPS.length - 1
              ? createJob.isPending
                ? "Saving..."
                : publish
                  ? "Publish role"
                  : "Save draft"
              : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

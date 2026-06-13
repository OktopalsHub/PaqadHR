"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { completeOnboarding, fetchPricingPreview } from "@/lib/api/onboarding";
import { queryKeys } from "@/lib/query/keys";
import { markOnboardingComplete } from "@/lib/session";
import { cn } from "@/lib/utils";

const STEPS = ["Company", "You", "Region", "Launch"] as const;

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Retail",
  "Manufacturing",
  "Professional Services",
  "Other",
];

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

const COUNTRIES = [
  { code: "NG", label: "Nigeria" },
  { code: "GLOBAL", label: "Global (USD)" },
];

function splitFullName(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function OnboardingWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [country, setCountry] = useState("NG");

  useEffect(() => {
    if (!user?.name || firstName || lastName) return;
    const parsed = splitFullName(user.name);
    setFirstName(parsed.firstName);
    setLastName(parsed.lastName);
  }, [user?.name, firstName, lastName]);

  const pricingQuery = useQuery({
    queryKey: queryKeys.onboarding.pricing(country),
    queryFn: () => fetchPricingPreview(country),
    enabled: step >= 2,
  });

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (result) => {
      markOnboardingComplete();
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      if (result.tenant?.id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.member.profile(result.tenant.id),
        });
      }
      toast.success(`Workspace "${result.tenant.name}" is ready`);
      router.push("/app");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const canContinue =
    step === 0
      ? name.trim().length >= 2
      : step === 1
        ? firstName.trim().length >= 1 &&
          lastName.trim().length >= 1 &&
          jobTitle.trim().length >= 2
        : step === 2
          ? Boolean(country)
          : true;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    completeMutation.mutate({
      name: name.trim(),
      industry: industry || undefined,
      companySize: companySize || undefined,
      businessCountry: country,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      preferredName: preferredName.trim() || undefined,
      jobTitle: jobTitle.trim(),
    });
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-10 flex items-center justify-center gap-2">
        {STEPS.map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                index <= step
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground",
              )}
            >
              {index + 1}
            </div>
            {index < STEPS.length - 1 ? (
              <div
                className={cn(
                  "h-px w-8",
                  index < step ? "bg-foreground" : "bg-border",
                )}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        {step === 0 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Set up your company
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us about your organization to personalize your workspace.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company name</Label>
                <Input
                  id="company-name"
                  placeholder="Acme Inc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company size</Label>
                <Select value={companySize} onValueChange={setCompanySize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item} employees
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                About you
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This is how you&apos;ll appear to your team in the workspace.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferred-name">
                  Preferred name{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="preferred-name"
                  placeholder="What should we call you on the dashboard?"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-title">Job position</Label>
                <Input
                  id="job-title"
                  placeholder="Head of People"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Billing region
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pricing is locked to your business location. This cannot be
                changed later.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pricingQuery.data ? (
              <div className="rounded-xl border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Starter plan preview</p>
                <p className="mt-1 text-muted-foreground">
                  Currency: {pricingQuery.data.currency} · 14-day free trial
                </p>
                {pricingQuery.data.pricing[0] ? (
                  <p className="mt-2 text-foreground">
                    From{" "}
                    {pricingQuery.data.pricing[0].price.currency}{" "}
                    {Number(
                      pricingQuery.data.pricing[0].price.monthlyPrice,
                    ).toLocaleString()}
                    /mo after trial
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Ready to launch
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review your workspace details before we create your account.
              </p>
            </div>
            <dl className="space-y-3 rounded-xl border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Company</dt>
                <dd className="font-medium">{name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">You</dt>
                <dd className="font-medium">
                  {firstName} {lastName}
                </dd>
              </div>
              {preferredName ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Preferred name</dt>
                  <dd className="font-medium">{preferredName}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Position</dt>
                <dd className="font-medium">{jobTitle}</dd>
              </div>
              {industry ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Industry</dt>
                  <dd className="font-medium">{industry}</dd>
                </div>
              ) : null}
              {companySize ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="font-medium">{companySize}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Region</dt>
                <dd className="font-medium">{country}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Trial</dt>
                <dd className="font-medium">14 days, all core features</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="mt-8 flex justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || completeMutation.isPending}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          <Button
            type="button"
            disabled={!canContinue || completeMutation.isPending}
            onClick={handleNext}
          >
            {step === STEPS.length - 1
              ? completeMutation.isPending
                ? "Creating..."
                : "Create workspace"
              : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

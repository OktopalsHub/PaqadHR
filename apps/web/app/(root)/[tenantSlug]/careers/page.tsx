'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Search,
  Star,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { OrgAvatar } from '@/components/org-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchPublicJobs,
  type PublicApplicationCustomAnswer,
  submitPublicApplication,
  uploadPublicCandidateFile,
} from '@/lib/api/recruitment';
import { getTenantBySlug } from '@/lib/api/tenants';
import type { JobOpening } from '@/lib/schemas/recruitment';
import type { Tenant } from '@/lib/schemas/tenant';

interface CustomQuestion {
  id?: string;
  questionText: string;
  description?: string;
  questionType:
    | 'SHORT_TEXT'
    | 'LONG_TEXT'
    | 'SINGLE_CHOICE'
    | 'MULTIPLE_CHOICE'
    | 'DATE'
    | 'FILE_UPLOAD'
    | 'RATING';
  isRequired: boolean;
  options?: string[];
  maxRating?: number;
}

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function PublicCareersPage() {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedLoc, setSelectedLoc] = useState('ALL');

  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploadProgress, setResumeUploadProgress] = useState(false);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [coverLetterUploadProgress, setCoverLetterUploadProgress] = useState(false);

  const [customAnswers, setCustomAnswers] = useState<Record<string, PublicApplicationCustomAnswer>>(
    {},
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  useEffect(() => {
    if (!params.tenantSlug) return;

    async function loadData() {
      try {
        setIsLoading(true);
        const tenantData = await getTenantBySlug(params.tenantSlug);
        if (!tenantData) {
          setError('Workspace not found');
          return;
        }
        setTenant(tenantData);

        const jobsData = await fetchPublicJobs(tenantData.id);
        setJobs(jobsData.jobs);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to load workspace data';
        setError(errMsg);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [params.tenantSlug]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    for (const job of jobs) {
      if (job.departmentName) depts.add(job.departmentName);
    }
    return Array.from(depts);
  }, [jobs]);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    for (const job of jobs) {
      if (job.location?.city) {
        locs.add(`${job.location.city}${job.location.country ? `, ${job.location.country}` : ''}`);
      } else if (job.location?.type === 'REMOTE') {
        locs.add('Remote');
      }
    }
    return Array.from(locs);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(search.toLowerCase()) ||
        job.description?.toLowerCase().includes(search.toLowerCase());

      const matchesDept = selectedDept === 'ALL' || job.departmentName === selectedDept;

      const matchesType = selectedType === 'ALL' || job.employmentType === selectedType;

      let matchesLoc = true;
      if (selectedLoc !== 'ALL') {
        if (selectedLoc === 'Remote') {
          matchesLoc = job.location?.type === 'REMOTE';
        } else {
          const formattedLoc = job.location?.city
            ? `${job.location.city}${job.location.country ? `, ${job.location.country}` : ''}`
            : '';
          matchesLoc = formattedLoc === selectedLoc;
        }
      }

      return matchesSearch && matchesDept && matchesType && matchesLoc;
    });
  }, [jobs, search, selectedDept, selectedType, selectedLoc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!firstName || !lastName || !email || !resumeFile) {
      toast.error('Please fill in all required fields and upload your resume.');
      return;
    }

    if (!agreeToPrivacy) {
      toast.error('Please accept the privacy policy to submit your application.');
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      toast.error('Please complete the security check before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);

      setResumeUploadProgress(true);
      const resumeUploadResult = await uploadPublicCandidateFile(
        selectedJob.id,
        resumeFile,
        'resumes',
      );
      setResumeUploadProgress(false);

      let coverLetterFilename: string | undefined;
      if (coverLetterFile) {
        setCoverLetterUploadProgress(true);
        const coverLetterUploadResult = await uploadPublicCandidateFile(
          selectedJob.id,
          coverLetterFile,
          'cover-letters',
        );
        coverLetterFilename = coverLetterUploadResult.fileName;
        setCoverLetterUploadProgress(false);
      }

      const payload = {
        firstName,
        lastName,
        email,
        phone,
        portfolioUrl: portfolioUrl || undefined,
        linkedinUrl: linkedinUrl || undefined,
        githubUrl: githubUrl || undefined,
        coverLetterText: coverLetterText || undefined,
        resumeFilename: resumeUploadResult.fileName,
        coverLetterFilename,
        customAnswers,
        experience: {
          years: 0,
        },
        dataProcessingConsent: true,
        turnstileToken: turnstileToken ?? undefined,
      };

      await submitPublicApplication(selectedJob.id, payload);
      setIsSuccess(true);
      toast.success('Application submitted successfully!');
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'Failed to submit application. Please try again.';
      toast.error(errMsg);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setIsSubmitting(false);
      setResumeUploadProgress(false);
      setCoverLetterUploadProgress(false);
    }
  };

  const renderCustomQuestion = (question: CustomQuestion) => {
    const questionId = question.id || question.questionText;
    const isRequired = question.isRequired;

    switch (question.questionType) {
      case 'SHORT_TEXT':
        return (
          <div key={questionId} className="space-y-2">
            <Label className="text-sm font-medium">
              {question.questionText} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            {question.description && (
              <p className="text-xs text-muted-foreground">{question.description}</p>
            )}
            <Input
              required={isRequired}
              value={(customAnswers[questionId] as string) || ''}
              onChange={(e) =>
                setCustomAnswers((prev) => ({ ...prev, [questionId]: e.target.value }))
              }
              placeholder="Your answer"
            />
          </div>
        );

      case 'LONG_TEXT':
        return (
          <div key={questionId} className="space-y-2">
            <Label className="text-sm font-medium">
              {question.questionText} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            {question.description && (
              <p className="text-xs text-muted-foreground">{question.description}</p>
            )}
            <Textarea
              required={isRequired}
              value={(customAnswers[questionId] as string) || ''}
              onChange={(e) =>
                setCustomAnswers((prev) => ({ ...prev, [questionId]: e.target.value }))
              }
              placeholder="Your answer"
              rows={4}
            />
          </div>
        );

      case 'SINGLE_CHOICE':
        return (
          <div key={questionId} className="space-y-2">
            <Label className="text-sm font-medium">
              {question.questionText} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            {question.description && (
              <p className="text-xs text-muted-foreground">{question.description}</p>
            )}
            <RadioGroup
              required={isRequired}
              value={(customAnswers[questionId] as string) || ''}
              onValueChange={(val) => setCustomAnswers((prev) => ({ ...prev, [questionId]: val }))}
              className="space-y-1 mt-1"
            >
              {(question.options || []).map((opt: string) => (
                <div key={opt} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt} id={`${questionId}-${opt}`} />
                  <Label
                    htmlFor={`${questionId}-${opt}`}
                    className="font-normal text-sm cursor-pointer"
                  >
                    {opt}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'MULTIPLE_CHOICE':
        return (
          <div key={questionId} className="space-y-2">
            <Label className="text-sm font-medium">
              {question.questionText} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            {question.description && (
              <p className="text-xs text-muted-foreground">{question.description}</p>
            )}
            <div className="space-y-2 mt-1">
              {(question.options || []).map((opt: string) => {
                const currentSelected = (customAnswers[questionId] as string[]) || [];
                const isChecked = currentSelected.includes(opt);

                return (
                  <div key={opt} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${questionId}-${opt}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const nextSelected = checked
                          ? [...currentSelected, opt]
                          : currentSelected.filter((item: string) => item !== opt);
                        setCustomAnswers((prev) => ({ ...prev, [questionId]: nextSelected }));
                      }}
                    />
                    <Label
                      htmlFor={`${questionId}-${opt}`}
                      className="font-normal text-sm cursor-pointer"
                    >
                      {opt}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'DATE':
        return (
          <div key={questionId} className="space-y-2">
            <Label className="text-sm font-medium">
              {question.questionText} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            {question.description && (
              <p className="text-xs text-muted-foreground">{question.description}</p>
            )}
            <Input
              type="date"
              required={isRequired}
              value={(customAnswers[questionId] as string) || ''}
              onChange={(e) =>
                setCustomAnswers((prev) => ({ ...prev, [questionId]: e.target.value }))
              }
            />
          </div>
        );

      case 'RATING': {
        const maxRating = question.maxRating || 5;
        return (
          <div key={questionId} className="space-y-2">
            <Label className="text-sm font-medium">
              {question.questionText} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            {question.description && (
              <p className="text-xs text-muted-foreground">{question.description}</p>
            )}
            <div className="flex items-center space-x-1.5 mt-1">
              {Array.from({ length: maxRating }).map((_, idx) => {
                const starVal = idx + 1;
                const isSelected = ((customAnswers[questionId] as number) || 0) >= starVal;
                return (
                  <button
                    type="button"
                    key={starVal}
                    onClick={() => setCustomAnswers((prev) => ({ ...prev, [questionId]: starVal }))}
                    className="p-1 focus:outline-none"
                  >
                    <Star
                      className={`h-6 w-6 ${isSelected ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5fbf8] py-12 text-foreground dark:bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading workspace details...</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5fbf8] px-4 text-center dark:bg-slate-950">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Workspace Not Found</h1>
        <p className="mt-2 text-muted-foreground max-w-md">
          {error ||
            'The workspace careers page you are looking for does not exist or has been deactivated.'}
        </p>
        <Button onClick={() => router.push('/')} className="mt-6">
          Go to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5fbf8] text-foreground selection:bg-primary/10 dark:bg-slate-950">
      <header className="sticky top-0 z-40 w-full border-b border-[#dcebe4] bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <OrgAvatar src={tenant.logoUrl} name={tenant.name} className="h-9 w-9 rounded-[8px]" />
            <span className="text-lg font-semibold tracking-tight">{tenant.name}</span>
          </div>
        </div>
      </header>

      <section className="px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[8px] bg-gradient-to-br from-[#043d32] via-[#076b56] to-[#08745c] px-6 py-10 text-white shadow-[0_18px_45px_rgba(4,61,50,0.18)] sm:px-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
            Careers at {tenant.name}
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Build meaningful work with a team that values people.
          </h1>
          <div className="mt-6 inline-flex rounded-full border border-white/40 bg-[#032d25]/45 px-3 py-1.5 text-sm font-medium text-white">
            {jobs.length} open role{jobs.length !== 1 ? 's' : ''} available
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="dashboard-panel mb-7 flex flex-col gap-4 rounded-[8px] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search roles or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-[#dcebe4] bg-white pl-9 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:focus:bg-slate-900"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-10 rounded-[8px] border border-[#dcebe4] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {}
            <select
              value={selectedLoc}
              onChange={(e) => setSelectedLoc(e.target.value)}
              className="h-10 rounded-[8px] border border-[#dcebe4] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="ALL">All Locations</option>
              <option value="Remote">Remote Only</option>
              {locations
                .filter((l) => l !== 'Remote')
                .map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
            </select>

            {}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-10 rounded-[8px] border border-[#dcebe4] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="ALL">All Job Types</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </div>
        </div>
        {(() => {
          const urgentJobs = jobs.filter((j) => j.isUrgent && j.status === 'ACTIVE');
          if (
            urgentJobs.length === 0 ||
            search ||
            selectedDept !== 'ALL' ||
            selectedType !== 'ALL' ||
            selectedLoc !== 'ALL'
          ) {
            return null;
          }
          return (
            <div className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-destructive fill-destructive" />
                <h2 className="text-lg font-bold">Featured &amp; Urgent Roles</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {urgentJobs.map((job) => (
                  <button
                    type="button"
                    key={`urgent-${job.id}`}
                    className="group flex w-full cursor-pointer flex-col justify-between rounded-[8px] border border-destructive/25 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-destructive/50 hover:shadow-md dark:border-destructive/40 dark:bg-slate-900"
                    onClick={() => {
                      setSelectedJob(job);
                      setShowApplyForm(false);
                      setIsSuccess(false);
                      setCustomAnswers({});
                    }}
                  >
                    <div>
                      <Badge variant="destructive" className="mb-2 text-xs">
                        Urgent
                      </Badge>
                      <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-destructive transition-colors">
                        {job.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{job.departmentName || 'General'}</span>
                        <span>·</span>
                        <span>
                          {job.location?.type === 'REMOTE' ? 'Remote' : job.location?.city || 'HQ'}
                        </span>
                        {job.position ? (
                          <>
                            <span>·</span>
                            <span>{job.position}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                        View &amp; Apply
                      </span>
                      <ChevronRight className="h-4 w-4 text-destructive group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {filteredJobs.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-[#c9ddd4] bg-white px-4 py-20 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No open roles found</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              We couldn't find any job openings matching your search criteria. Try adjusting your
              filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => (
              <button
                type="button"
                key={job.id}
                className="group flex w-full cursor-pointer flex-col justify-between rounded-[8px] border border-[#dcebe4] bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                onClick={() => {
                  setSelectedJob(job);
                  setShowApplyForm(false);
                  setIsSuccess(false);
                  setCustomAnswers({});
                }}
              >
                <div className="w-full">
                  <div className="flex items-start justify-between">
                    <Badge
                      variant={job.isUrgent ? 'destructive' : 'outline'}
                      className="capitalize font-medium text-xs"
                    >
                      {job.isUrgent
                        ? 'Urgent'
                        : job.employmentType?.replace('_', ' ').toLowerCase() || 'Full-time'}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {job.publishedAt
                        ? new Date(job.publishedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Recently'}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {job.title}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-y-2 gap-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center">
                      <Building className="h-4 w-4 mr-1 text-muted-foreground/80" />
                      {job.departmentName || 'General'}
                    </span>
                    <span className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1 text-muted-foreground/80" />
                      {job.location?.type === 'REMOTE' ? 'Remote' : `${job.location?.city || 'HQ'}`}
                    </span>
                    {job.position ? (
                      <span className="flex items-center">
                        <Briefcase className="h-4 w-4 mr-1 text-muted-foreground/80" />
                        {job.position}
                      </span>
                    ) : null}
                    {job.numberOfOpenings != null && job.numberOfOpenings > 0 ? (
                      <span className="text-xs text-muted-foreground/80">
                        {job.numberOfOpenings} opening{job.numberOfOpenings !== 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>
                  {job.applicationDeadline ? (
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      Deadline:{' '}
                      {new Date(job.applicationDeadline).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="mt-6 pt-4 border-t flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                    View & Apply
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-16 border-t border-[#dcebe4] bg-white/70 py-10 dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {tenant.name}. Powered by Paqad HR.
          </p>
        </div>
      </footer>

      <Sheet
        open={selectedJob !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedJob(null);
        }}
      >
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto px-6 py-6" side="right">
          {selectedJob && (
            <div className="space-y-6">
              {!showApplyForm ? (
                <>
                  <SheetHeader className="text-left border-b pb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="capitalize">
                        {selectedJob.employmentType?.replace('_', ' ').toLowerCase()}
                      </Badge>
                      {selectedJob.isUrgent && <Badge variant="destructive">Urgent</Badge>}
                    </div>
                    <SheetTitle className="text-2xl font-bold tracking-tight">
                      {selectedJob.title}
                    </SheetTitle>
                    <div className="flex flex-wrap gap-y-1 gap-x-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center">
                        <Building className="h-4 w-4 mr-1" />
                        {selectedJob.departmentName || 'General'}
                      </span>
                      <span className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {selectedJob.location?.type === 'REMOTE'
                          ? 'Remote'
                          : `${selectedJob.location?.city}, ${selectedJob.location?.country}`}
                      </span>
                      <span className="flex items-center">
                        <Briefcase className="h-4 w-4 mr-1" />
                        {selectedJob.experienceLevel || 'Mid-Level'}
                      </span>
                    </div>
                  </SheetHeader>

                  <div className="space-y-4 py-4 border-b">
                    <h3 className="font-semibold text-lg text-foreground">About the role</h3>
                    <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {selectedJob.description}
                    </div>
                  </div>

                  {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                    <div className="space-y-3 py-4 border-b">
                      <h3 className="font-semibold text-lg text-foreground">Requirements</h3>
                      <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                        {selectedJob.requirements.map((req) => (
                          <li key={req}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedJob.responsibilities && selectedJob.responsibilities.length > 0 && (
                    <div className="space-y-3 py-4 border-b">
                      <h3 className="font-semibold text-lg text-foreground">Responsibilities</h3>
                      <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                        {selectedJob.responsibilities.map((resp) => (
                          <li key={resp}>{resp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-6 flex justify-end">
                    <Button
                      onClick={() => setShowApplyForm(true)}
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Apply for this role
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSubmitting) setShowApplyForm(false);
                    }}
                    className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 focus:outline-none"
                    disabled={isSubmitting}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back to job details
                  </button>

                  <SheetHeader className="text-left border-b pb-6">
                    <SheetTitle className="text-2xl font-bold">
                      Apply for {selectedJob.title}
                    </SheetTitle>
                    <SheetDescription>
                      Submit your application details below. Fields marked with * are required. Your
                      data will be processed by {tenant.name} via Paqad to evaluate your
                      application. See our{' '}
                      <Link href="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>{' '}
                      or contact{' '}
                      <a href="mailto:privacy@paqad.com" className="text-primary hover:underline">
                        privacy@paqad.com
                      </a>{' '}
                      to request access or deletion of application data.
                    </SheetDescription>
                  </SheetHeader>

                  {isSuccess ? (
                    <div className="py-12 text-center space-y-4">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                      <h2 className="text-xl font-bold tracking-tight">Application Submitted!</h2>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Thank you for your interest in joining {tenant.name}. We've received your
                        application and will review it shortly. A confirmation has been sent to your
                        email.
                      </p>
                      <div className="pt-6">
                        <Button
                          onClick={() => {
                            setSelectedJob(null);
                            setShowApplyForm(false);
                            setIsSuccess(false);
                          }}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6 py-4">
                      {}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-sm font-medium">
                            First Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="firstName"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="John"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-sm font-medium">
                            Last Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="lastName"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Doe"
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      {}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium">
                            Email <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john.doe@example.com"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm font-medium">
                            Phone
                          </Label>
                          <Input
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      {}
                      <div className="space-y-2 border-t pt-4">
                        <h3 className="font-semibold text-sm text-foreground">
                          Professional Profiles
                        </h3>
                        <div className="grid gap-3 mt-2">
                          <div className="space-y-1">
                            <Label htmlFor="portfolioUrl" className="text-xs text-muted-foreground">
                              Portfolio Website
                            </Label>
                            <Input
                              id="portfolioUrl"
                              type="url"
                              value={portfolioUrl}
                              onChange={(e) => setPortfolioUrl(e.target.value)}
                              placeholder="https://my-work.com"
                              disabled={isSubmitting}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="linkedinUrl" className="text-xs text-muted-foreground">
                              LinkedIn URL
                            </Label>
                            <Input
                              id="linkedinUrl"
                              type="url"
                              value={linkedinUrl}
                              onChange={(e) => setLinkedinUrl(e.target.value)}
                              placeholder="https://linkedin.com/in/username"
                              disabled={isSubmitting}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="githubUrl" className="text-xs text-muted-foreground">
                              GitHub URL
                            </Label>
                            <Input
                              id="githubUrl"
                              type="url"
                              value={githubUrl}
                              onChange={(e) => setGithubUrl(e.target.value)}
                              placeholder="https://github.com/username"
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                      </div>

                      {}
                      <div className="space-y-2 border-t pt-4">
                        <Label className="text-sm font-medium">
                          Resume / CV <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex justify-center rounded-lg border border-dashed border-border px-6 py-6 hover:bg-muted/10 transition-colors">
                          <div className="text-center space-y-1.5">
                            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                            <div className="flex text-sm justify-center text-muted-foreground">
                              <label
                                htmlFor="file-upload-resume"
                                className="relative cursor-pointer rounded-md font-semibold text-primary hover:underline focus-within:outline-none"
                              >
                                <span>Upload a file</span>
                                <input
                                  id="file-upload-resume"
                                  name="file-upload-resume"
                                  type="file"
                                  accept=".pdf,.doc,.docx"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (files && files.length > 0) {
                                      setResumeFile(files[0]);
                                    }
                                  }}
                                  disabled={isSubmitting}
                                />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              PDF, DOC, DOCX up to 10MB
                            </p>
                            {resumeFile && (
                              <Badge variant="secondary" className="mt-2 text-xs py-1">
                                Selected: {resumeFile.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {}
                      <div className="space-y-2 border-t pt-4">
                        <Label className="text-sm font-medium">Cover Letter</Label>
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Write your cover letter here..."
                            value={coverLetterText}
                            onChange={(e) => setCoverLetterText(e.target.value)}
                            rows={4}
                            disabled={isSubmitting || !!coverLetterFile}
                          />
                          <div className="text-center text-xs text-muted-foreground">- OR -</div>
                          <div className="flex justify-center rounded-lg border border-dashed border-border px-6 py-4 hover:bg-muted/10 transition-colors">
                            <div className="text-center space-y-1">
                              <label
                                htmlFor="file-upload-cover"
                                className="relative cursor-pointer rounded-md font-semibold text-primary hover:underline focus-within:outline-none text-sm"
                              >
                                <span>Upload cover letter document</span>
                                <input
                                  id="file-upload-cover"
                                  name="file-upload-cover"
                                  type="file"
                                  accept=".pdf,.doc,.docx"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (files && files.length > 0) {
                                      setCoverLetterFile(files[0]);
                                    }
                                  }}
                                  disabled={isSubmitting || !!coverLetterText}
                                />
                              </label>
                              {coverLetterFile && (
                                <Badge variant="secondary" className="mt-2 text-xs py-1">
                                  Selected: {coverLetterFile.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {}
                      {selectedJob.customQuestions && selectedJob.customQuestions.length > 0 && (
                        <div className="space-y-5 border-t pt-4">
                          <h3 className="font-semibold text-sm text-foreground">
                            Additional Questions
                          </h3>
                          <div className="space-y-5">
                            {selectedJob.customQuestions.map((q: CustomQuestion) =>
                              renderCustomQuestion(q),
                            )}
                          </div>
                        </div>
                      )}

                      {turnstileSiteKey ? (
                        <div className="border-t pt-4 flex justify-center">
                          <Turnstile
                            ref={turnstileRef}
                            siteKey={turnstileSiteKey}
                            onSuccess={handleTurnstileSuccess}
                            options={{ theme: 'auto' }}
                          />
                        </div>
                      ) : null}

                      <div className="flex items-start gap-2 border-t pt-4">
                        <Checkbox
                          id="apply-privacy-consent"
                          checked={agreeToPrivacy}
                          onCheckedChange={(checked) => setAgreeToPrivacy(checked === true)}
                          disabled={isSubmitting}
                        />
                        <Label
                          htmlFor="apply-privacy-consent"
                          className="text-sm leading-5 text-muted-foreground"
                        >
                          I agree that my application data will be processed according to the{' '}
                          <Link href="/privacy" className="text-primary hover:underline">
                            Privacy Policy
                          </Link>
                          .
                        </Label>
                      </div>

                      <div className="pt-4 border-t flex flex-col gap-2">
                        <Button
                          type="submit"
                          size="lg"
                          disabled={isSubmitting || !agreeToPrivacy}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {resumeUploadProgress
                                ? 'Uploading Resume...'
                                : coverLetterUploadProgress
                                  ? 'Uploading Cover Letter...'
                                  : 'Submitting Application...'}
                            </>
                          ) : (
                            'Submit Application'
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

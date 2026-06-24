'use client';

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
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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

export default function PublicCareersPage() {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & filter states
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedLoc, setSelectedLoc] = useState('ALL');

  // Selected job for detail view
  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');

  // File upload states
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploadProgress, setResumeUploadProgress] = useState(false);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [coverLetterUploadProgress, setCoverLetterUploadProgress] = useState(false);

  // Custom questions answers
  // Keyed by question ID or custom question identifier (like questionText)
  const [customAnswers, setCustomAnswers] = useState<Record<string, unknown>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch tenant info and active job openings
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
        console.error('Failed to load careers page:', err);
        const errMsg = err instanceof Error ? err.message : 'Failed to load workspace data';
        setError(errMsg);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [params.tenantSlug]);

  // Unique lists for filtering
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

  // Filtered job openings
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

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!firstName || !lastName || !email || !resumeFile) {
      toast.error('Please fill in all required fields and upload your resume.');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Upload Resume
      setResumeUploadProgress(true);
      const resumeUploadResult = await uploadPublicCandidateFile(
        selectedJob.id,
        resumeFile,
        'resumes',
      );
      setResumeUploadProgress(false);

      // 2. Upload Cover Letter if selected
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

      // 3. Submit application
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
      };

      await submitPublicApplication(selectedJob.id, payload);
      setIsSuccess(true);
      toast.success('Application submitted successfully!');
    } catch (err: unknown) {
      console.error('Failed to submit application:', err);
      const errMsg =
        err instanceof Error ? err.message : 'Failed to submit application. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
      setResumeUploadProgress(false);
      setCoverLetterUploadProgress(false);
    }
  };

  // Render dynamic custom questions
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-background py-12">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading workspace details...</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10">
      {/* Public Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            {tenant.logoUrl ? (
              // biome-ignore lint/performance/noImgElement: R2 bucket images are dynamic and non-static
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-9 w-9 rounded-lg object-contain bg-white p-0.5 border"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold border border-primary/20">
                {tenant.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-bold text-lg tracking-tight">{tenant.name}</span>
          </div>

          <div className="flex items-center space-x-4">
            <Badge
              variant="secondary"
              className="px-3 py-1 font-medium capitalize text-xs bg-secondary/60"
            >
              {tenant.industry || 'People Operations'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-24 border-b bg-gradient-to-b from-primary/[0.02] to-transparent">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
            Be part of our mission
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed">
            We are looking for passionate, driven individuals to join our team at{' '}
            <strong className="text-foreground">{tenant.name}</strong>. Explore our open positions
            and build the future with us.
          </p>

          <div className="mt-10 flex justify-center space-x-8 text-center border-t border-border/60 pt-10 max-w-2xl mx-auto">
            <div>
              <p className="text-3xl font-extrabold text-primary">{jobs.length}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                Open Roles
              </p>
            </div>
            <div className="border-r border-border" />
            <div>
              <p className="text-3xl font-extrabold text-primary">{tenant.location || 'Remote'}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                Primary Location
              </p>
            </div>
            <div className="border-r border-border" />
            <div>
              <p className="text-3xl font-extrabold text-primary">
                {tenant.companySize || 'Growing'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                Company Size
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Search & Jobs List */}
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-8 mb-10">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search roles or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/40 border-muted/80 focus:bg-background"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-10 px-3 border rounded-md text-sm bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary border-border"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Location Filter */}
            <select
              value={selectedLoc}
              onChange={(e) => setSelectedLoc(e.target.value)}
              className="h-10 px-3 border rounded-md text-sm bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary border-border"
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

            {/* Job Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-10 px-3 border rounded-md text-sm bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary border-border"
            >
              <option value="ALL">All Job Types</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </div>
        </div>

        {/* Job Listings */}
        {filteredJobs.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/10">
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
                className="group flex flex-col text-left w-full justify-between p-6 border rounded-2xl bg-card transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 cursor-pointer"
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
                  </div>
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

      {/* Footer */}
      <footer className="border-t bg-muted/20 mt-32 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {tenant.name}. Powered by Paqad HR.
          </p>
        </div>
      </footer>

      {/* Job Details Modal/Sheet */}
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

                  {/* Job Description */}
                  <div className="space-y-4 py-4 border-b">
                    <h3 className="font-semibold text-lg text-foreground">About the role</h3>
                    <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {selectedJob.description}
                    </div>
                  </div>

                  {/* Requirements */}
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

                  {/* Responsibilities */}
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
                  {/* Back to details button */}
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
                      Submit your application details below. All fields marked with * are required.
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
                      {/* Name Fields */}
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

                      {/* Contact Fields */}
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

                      {/* Professional Profile links */}
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

                      {/* Resume File Upload */}
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

                      {/* Cover Letter Plaintext/File Upload */}
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

                      {/* Custom Questions Section */}
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

                      {/* Submit Button */}
                      <div className="pt-6 border-t flex flex-col gap-2">
                        <Button
                          type="submit"
                          size="lg"
                          disabled={isSubmitting}
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

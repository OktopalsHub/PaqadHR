'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Loader2, Trash2, Upload, Folder, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import {
  createMemberDocument,
  deleteMemberDocument,
  downloadDocument,
  fetchMemberDocuments,
  verifyMemberDocument,
} from '@/lib/api/documents';
import { requestDocumentUploadUrl, uploadFileToPresignedUrl } from '@/lib/api/files';
import { downloadPayslipPdf, fetchMemberPublishedPayslips } from '@/lib/api/payroll';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';

const UPLOAD_DOCUMENT_TYPES = [
  { value: 'employment_contract', label: 'Employment contract' },
  { value: 'offer_letter', label: 'Offer letter' },
  { value: 'nda', label: 'NDA (Non-Disclosure Agreement)' },
  { value: 'resume_cv', label: 'Resume / CV' },
  { value: 'id_card', label: 'ID card' },
  { value: 'passport', label: 'Passport' },
  { value: 'tax_forms', label: 'Tax forms' },
  { value: 'other', label: 'Other' },
] as const;

interface DocumentsTabProps {
  memberId: string;
  isSelf: boolean;
  isAdmin: boolean;
}

export function DocumentsTab({ memberId, isSelf, isAdmin }: DocumentsTabProps) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<string>(UPLOAD_DOCUMENT_TYPES[0].value);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const documentsQueryKey = [...queryKeys.employees.detail(memberId), tenantId, 'documents'];

  const { data: allDocs = [], isLoading } = useQuery({
    queryKey: [...documentsQueryKey, 'all'],
    queryFn: () => fetchMemberDocuments(memberId, tenantId!),
    enabled: Boolean(memberId && tenantId),
  });

  const { data: publishedPayslips = [], isLoading: payslipsLoading } = useQuery({
    queryKey: [...queryKeys.payroll.all, tenantId, 'published-payslips', memberId],
    queryFn: () => fetchMemberPublishedPayslips(memberId),
    enabled: Boolean(memberId && tenantId),
  });

  const employeeDocs = allDocs.filter((doc) => doc.type !== 'pay_stub');
  const legacyPayStubs = allDocs.filter((doc) => doc.type === 'pay_stub');

  const showPayrollSection = isAdmin || (isSelf && publishedPayslips.length > 0);
  const canUpload = isAdmin; // Only admin role should be able to upload

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Choose a file');
      if (!uploadName.trim()) throw new Error('Enter a document name');
      if (!tenantId) throw new Error('Tenant ID is required');

      const { uploadUrl, fileName } = await requestDocumentUploadUrl(
        selectedFile.name,
        selectedFile.type || undefined,
        tenantId,
      );
      await uploadFileToPresignedUrl(uploadUrl, selectedFile);
      return createMemberDocument(
        memberId,
        {
          name: uploadName.trim(),
          type: uploadType,
          fileKey: fileName,
        },
        tenantId,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...documentsQueryKey, 'all'] });
      toast.success('Document uploaded');
      setUploadOpen(false);
      setUploadName('');
      setSelectedFile(null);
      setUploadType(UPLOAD_DOCUMENT_TYPES[0].value);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    },
  });

  const handleDownloadPayslip = async (payslip: {
    runId: string;
    itemId: string;
    runTitle: string;
    periodEnd?: string | Date;
  }) => {
    try {
      const period =
        payslip.periodEnd != null
          ? new Date(payslip.periodEnd).toISOString().slice(0, 10)
          : payslip.runTitle.replace(/\s+/g, '-').toLowerCase();
      await downloadPayslipPdf(payslip.runId, payslip.itemId, `payslip-${period}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDownload = async (documentId: string, name: string) => {
    try {
      const url = await downloadDocument(documentId, tenantId!);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      await deleteMemberDocument(documentId, tenantId!);
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...documentsQueryKey, 'all'] });
      toast.success('Document deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleVerify = async (documentId: string) => {
    try {
      await verifyMemberDocument(documentId, tenantId!);
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...documentsQueryKey, 'all'] });
      toast.success('Document verified');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verify failed');
    }
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file && !uploadName.trim()) {
      setUploadName(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  // Categorization lists
  const EMPLOYMENT_DETAILS_TYPES = [
    'employment_contract',
    'offer_letter',
    'nda',
    'probation_agreement',
    'non_compete',
    'acceptance_letter',
  ];

  const CV_TYPES = ['resume_cv'];

  // Sorting: most recent first
  const sortedDocs = [...employeeDocs].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const employmentDetailsDocs = sortedDocs.filter((doc) =>
    EMPLOYMENT_DETAILS_TYPES.includes(doc.type),
  );
  const cvDocs = sortedDocs.filter((doc) => CV_TYPES.includes(doc.type));
  const othersDocs = sortedDocs.filter(
    (doc) =>
      !EMPLOYMENT_DETAILS_TYPES.includes(doc.type) &&
      !CV_TYPES.includes(doc.type),
  );

  // Unified sorting of payslips (legacy + published)
  const legacyItems = legacyPayStubs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    date: doc.issueDate
      ? new Date(doc.issueDate)
      : doc.createdAt
        ? new Date(doc.createdAt)
        : new Date(0),
    displayDate: doc.issueDate
      ? new Date(doc.issueDate).toLocaleDateString()
      : doc.createdAt
        ? new Date(doc.createdAt).toLocaleDateString()
        : 'N/A',
    type: 'legacy' as const,
    docId: doc.id,
  }));

  const publishedItems = publishedPayslips.map((payslip) => {
    const dateVal = payslip.periodEnd
      ? new Date(payslip.periodEnd)
      : payslip.paidAt
        ? new Date(payslip.paidAt)
        : payslip.publishedAt
          ? new Date(payslip.publishedAt)
          : new Date(0);
    const displayDateVal = payslip.periodEnd
      ? new Date(payslip.periodEnd).toLocaleDateString()
      : payslip.paidAt
        ? new Date(payslip.paidAt).toLocaleDateString()
        : 'N/A';
    return {
      id: payslip.itemId,
      name: payslip.runTitle,
      date: dateVal,
      displayDate: displayDateVal,
      type: 'published' as const,
      runId: payslip.runId,
      itemId: payslip.itemId,
      periodEnd: payslip.periodEnd,
      paidAt: payslip.paidAt,
    };
  });

  const allPayslips = [...legacyItems, ...publishedItems].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    employment: true,
    cv: true,
    others: false,
    payslips: false,
  });

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  const renderDocRow = (doc: typeof employeeDocs[0]) => (
    <div key={doc.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{doc.name}</p>
          {isAdmin && !doc.isVerified ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/30">Unverified</Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {doc.type.replaceAll('_', ' ')}
          {doc.createdAt
            ? ` · ${new Date(doc.createdAt).toLocaleDateString()}`
            : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isAdmin && !doc.isVerified ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs px-2.5"
            onClick={() => void handleVerify(doc.id)}
          >
            Verify
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => void handleDownload(doc.id, doc.name)}
        >
          <Download className="size-4" />
        </Button>
        {isAdmin ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 hover:text-destructive hover:bg-destructive/10"
            onClick={() => void handleDelete(doc.id)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        ) : null}
      </div>
    </div>
  );

  const renderPayslipRow = (payslip: (typeof allPayslips)[0]) => (
    <div key={payslip.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{payslip.name}</p>
          {payslip.type === 'published' ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 text-emerald-600 dark:text-emerald-400 border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/20">Published</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 text-orange-600 dark:text-orange-400 border-orange-600/30 bg-orange-50 dark:bg-orange-950/20">Legacy</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {payslip.displayDate}
          {payslip.type === 'published' && payslip.paidAt
            ? ` · Paid ${new Date(payslip.paidAt).toLocaleDateString()}`
            : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            if (payslip.type === 'published') {
              void handleDownloadPayslip({
                runId: payslip.runId!,
                itemId: payslip.itemId!,
                runTitle: payslip.name,
                periodEnd: payslip.periodEnd,
              });
            } else {
              void handleDownload(payslip.docId!, payslip.name);
            }
          }}
        >
          <Download className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <TabsContent value="documents">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Documents & Files</CardTitle>
            <CardDescription>View and manage employee documents</CardDescription>
          </div>
          {canUpload ? (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Upload className="mr-2 size-4" />
                  Upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload document</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="doc-file">File</Label>
                    <Input
                      id="doc-file"
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doc-name">Name</Label>
                    <Input
                      id="doc-name"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="Employment contract"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doc-type">Type</Label>
                    <Select value={uploadType} onValueChange={setUploadType}>
                      <SelectTrigger id="doc-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UPLOAD_DOCUMENT_TYPES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={uploadMutation.isPending || !selectedFile}
                    onClick={() => uploadMutation.mutate()}
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    Upload document
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading || (showPayrollSection && payslipsLoading) ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm">Loading documents and payslips...</p>
              </div>
            ) : (
              <>
                {/* Employment Details Folder */}
                <div className="flex flex-col border rounded-lg overflow-hidden bg-card">
                  <button
                    type="button"
                    onClick={() => toggleFolder('employment')}
                    className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {expandedFolders.employment ? (
                        <FolderOpen className="size-5 text-blue-500 fill-blue-500/10 shrink-0" />
                      ) : (
                        <Folder className="size-5 text-blue-500 fill-blue-500/10 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-sm">Employment Details</span>
                        <p className="text-xs text-muted-foreground">Contracts, NDAs, offer letters, and agreements</p>
                      </div>
                      <Badge variant="secondary" className="ml-2 font-medium text-xs">
                        {employmentDetailsDocs.length}
                      </Badge>
                    </div>
                    {expandedFolders.employment ? (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {expandedFolders.employment && (
                    <div className="border-t divide-y bg-background/50">
                      {employmentDetailsDocs.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          No employment details on file.
                        </div>
                      ) : (
                        employmentDetailsDocs.map(renderDocRow)
                      )}
                    </div>
                  )}
                </div>

                {/* CV Folder */}
                <div className="flex flex-col border rounded-lg overflow-hidden bg-card">
                  <button
                    type="button"
                    onClick={() => toggleFolder('cv')}
                    className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {expandedFolders.cv ? (
                        <FolderOpen className="size-5 text-emerald-500 fill-emerald-500/10 shrink-0" />
                      ) : (
                        <Folder className="size-5 text-emerald-500 fill-emerald-500/10 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-sm">CV / Resume</span>
                        <p className="text-xs text-muted-foreground">Employee curriculums and resumes</p>
                      </div>
                      <Badge variant="secondary" className="ml-2 font-medium text-xs">
                        {cvDocs.length}
                      </Badge>
                    </div>
                    {expandedFolders.cv ? (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {expandedFolders.cv && (
                    <div className="border-t divide-y bg-background/50">
                      {cvDocs.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          No CV or resume on file.
                        </div>
                      ) : (
                        cvDocs.map(renderDocRow)
                      )}
                    </div>
                  )}
                </div>

                {/* Others Folder */}
                <div className="flex flex-col border rounded-lg overflow-hidden bg-card">
                  <button
                    type="button"
                    onClick={() => toggleFolder('others')}
                    className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {expandedFolders.others ? (
                        <FolderOpen className="size-5 text-amber-500 fill-amber-500/10 shrink-0" />
                      ) : (
                        <Folder className="size-5 text-amber-500 fill-amber-500/10 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-sm">Others</span>
                        <p className="text-xs text-muted-foreground">IDs, passports, tax forms, and miscellaneous files</p>
                      </div>
                      <Badge variant="secondary" className="ml-2 font-medium text-xs">
                        {othersDocs.length}
                      </Badge>
                    </div>
                    {expandedFolders.others ? (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {expandedFolders.others && (
                    <div className="border-t divide-y bg-background/50">
                      {othersDocs.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          No other documents on file.
                        </div>
                      ) : (
                        othersDocs.map(renderDocRow)
                      )}
                    </div>
                  )}
                </div>

                {/* Payslips Folder */}
                {showPayrollSection && (
                  <div className="flex flex-col border rounded-lg overflow-hidden bg-card">
                    <button
                      type="button"
                      onClick={() => toggleFolder('payslips')}
                      className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {expandedFolders.payslips ? (
                          <FolderOpen className="size-5 text-purple-500 fill-purple-500/10 shrink-0" />
                        ) : (
                          <Folder className="size-5 text-purple-500 fill-purple-500/10 shrink-0" />
                        )}
                        <div>
                          <span className="font-semibold text-sm">Payslips</span>
                          <p className="text-xs text-muted-foreground">Published payslips and legacy pay stubs</p>
                        </div>
                        <Badge variant="secondary" className="ml-2 font-medium text-xs">
                          {allPayslips.length}
                        </Badge>
                      </div>
                      {expandedFolders.payslips ? (
                        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    {expandedFolders.payslips && (
                      <div className="border-t divide-y bg-background/50">
                        {allPayslips.length === 0 ? (
                          <div className="p-8 text-center text-sm text-muted-foreground">
                            {isAdmin
                              ? 'No published payslips yet. Publish them from a completed payroll run.'
                              : 'No published payslips yet.'}
                          </div>
                        ) : (
                          allPayslips.map(renderPayslipRow)
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

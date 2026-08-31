'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { DestructiveConfirmDialog } from '@/components/destructive-confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const [uploadConfirmationOpen, setUploadConfirmationOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<string>(UPLOAD_DOCUMENT_TYPES[0].value);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedFolder, setExpandedFolder] = useState<string | null>('employment');
  const [documentPendingDeletion, setDocumentPendingDeletion] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
  const canUpload = isAdmin;

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
      setUploadConfirmationOpen(false);
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

  const requestUpload = () => {
    if (!selectedFile) {
      toast.error('Choose a file');
      return;
    }
    if (!uploadName.trim()) {
      toast.error('Enter a document name');
      return;
    }
    setUploadConfirmationOpen(true);
  };

  const EMPLOYMENT_DETAILS_TYPES = [
    'employment_contract',
    'offer_letter',
    'nda',
    'probation_agreement',
    'non_compete',
    'acceptance_letter',
  ];

  const CV_TYPES = ['resume_cv'];

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
    (doc) => !EMPLOYMENT_DETAILS_TYPES.includes(doc.type) && !CV_TYPES.includes(doc.type),
  );

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

  const folders = [
    {
      key: 'employment',
      label: 'Employment Details',
      color: 'blue',
      docs: employmentDetailsDocs,
    },
    {
      key: 'cv',
      label: 'CV / Resume',
      color: 'emerald',
      docs: cvDocs,
    },
    {
      key: 'others',
      label: 'Others',
      color: 'amber',
      docs: othersDocs,
    },
    ...(showPayrollSection
      ? [
          {
            key: 'payslips',
            label: 'Payslips',
            color: 'purple',
            docs: allPayslips,
          },
        ]
      : []),
  ];

  const renderDocRow = (doc: (typeof employeeDocs)[0]) => (
    <div
      key={doc.id}
      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{doc.name}</p>
          {isAdmin && !doc.isVerified ? (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/30"
            >
              Unverified
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {doc.type.replaceAll('_', ' ')}
          {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString()}` : ''}
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
            onClick={() => setDocumentPendingDeletion({ id: doc.id, name: doc.name })}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        ) : null}
      </div>
    </div>
  );

  const renderPayslipRow = (payslip: (typeof allPayslips)[0]) => (
    <div
      key={payslip.id}
      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{payslip.name}</p>
          {payslip.type === 'published' ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4.5 text-emerald-600 dark:text-emerald-400 border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/20"
            >
              Published
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4.5 text-orange-600 dark:text-orange-400 border-orange-600/30 bg-orange-50 dark:bg-orange-950/20"
            >
              Legacy
            </Badge>
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

  const folderColorMap: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    purple: 'text-purple-500',
  };

  return (
    <TabsContent value="documents" className="mt-4">
      <div className="rounded-md border border-border/80 bg-white p-4 shadow-sm dark:bg-card sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Documents</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage employee files and records in one place.
            </p>
          </div>
          {canUpload ? (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="shrink-0">
                  <Upload className="mr-1.5 size-4" />
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
                    onClick={requestUpload}
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
        </div>

        {isLoading || (showPayrollSection && payslipsLoading) ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm">Loading documents...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map((folder) => {
              const isExpanded = expandedFolder === folder.key;
              const count = folder.key === 'payslips' ? allPayslips.length : folder.docs.length;
              const Icon = isExpanded ? FolderOpen : Folder;

              return (
                <div
                  key={folder.key}
                  className="overflow-hidden rounded-lg border border-border/80 bg-white transition-shadow hover:shadow-sm dark:bg-card"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFolder(isExpanded ? null : folder.key)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <Icon
                      className={`size-4 shrink-0 ${folderColorMap[folder.color] ?? 'text-muted-foreground'}`}
                    />
                    <span className="font-medium text-sm flex-1">{folder.label}</span>
                    <Badge variant="secondary" className="font-medium text-xs tabular-nums">
                      {count}
                    </Badge>
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="divide-y border-t bg-muted/20">
                      {folder.key === 'payslips' ? (
                        allPayslips.length === 0 ? (
                          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                            {isAdmin
                              ? 'No published payslips yet. Publish them from a completed payroll run.'
                              : 'No published payslips yet.'}
                          </div>
                        ) : (
                          allPayslips.map(renderPayslipRow)
                        )
                      ) : folder.docs.length === 0 ? (
                        <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                          No documents in this folder.
                        </div>
                      ) : (
                        (folder.docs as typeof employeeDocs).map(renderDocRow)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <DestructiveConfirmDialog
        open={Boolean(documentPendingDeletion)}
        onOpenChange={(open) => !open && setDocumentPendingDeletion(null)}
        title="Delete document?"
        description={`"${documentPendingDeletion?.name ?? 'This document'}" will be permanently deleted.`}
        actionLabel="Delete document"
        onConfirm={() => {
          if (documentPendingDeletion) void handleDelete(documentPendingDeletion.id);
          setDocumentPendingDeletion(null);
        }}
      />
      <ConfirmActionDialog
        open={uploadConfirmationOpen}
        onOpenChange={setUploadConfirmationOpen}
        title="Upload document?"
        description="The selected document will be added to this employee profile."
        actionLabel="Upload document"
        isPending={uploadMutation.isPending}
        onConfirm={() => uploadMutation.mutate()}
      />
    </TabsContent>
  );
}

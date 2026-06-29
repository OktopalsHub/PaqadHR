'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  { value: 'id_card', label: 'ID card' },
  { value: 'passport', label: 'Passport' },
  { value: 'employment_contract', label: 'Employment contract' },
  { value: 'offer_letter', label: 'Offer letter' },
  { value: 'resume_cv', label: 'Resume / CV' },
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
  const canUpload = isAdmin || isSelf;

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
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Employee documents</h4>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading documents…</p>
              ) : employeeDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employee documents on file.</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {employeeDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{doc.name}</p>
                          {isAdmin && !doc.isVerified ? (
                            <Badge variant="secondary">Unverified</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {doc.type.replaceAll('_', ' ')}
                          {doc.createdAt
                            ? ` · ${new Date(doc.createdAt).toLocaleDateString()}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isAdmin && !doc.isVerified ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleVerify(doc.id)}
                          >
                            Verify
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDownload(doc.id, doc.name)}
                        >
                          <Download className="size-4" />
                        </Button>
                        {canUpload ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDelete(doc.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showPayrollSection ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <h4 className="font-medium">Payroll</h4>
                </div>
                {legacyPayStubs.length > 0 && isAdmin ? (
                  <Collapsible className="rounded-lg border">
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left text-sm font-medium hover:bg-muted/50">
                      Legacy payslips ({legacyPayStubs.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="divide-y border-t">
                      {legacyPayStubs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-3 p-4">
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Uploaded payslip
                              {doc.issueDate
                                ? ` · ${new Date(doc.issueDate).toLocaleDateString()}`
                                : ''}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDownload(doc.id, doc.name)}
                          >
                            <Download className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
                {payslipsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading payslips…</p>
                ) : publishedPayslips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isAdmin
                      ? 'No published payslips yet. Publish them from a completed payroll run.'
                      : 'No published payslips yet.'}
                  </p>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {publishedPayslips.map((payslip) => (
                      <div
                        key={payslip.itemId}
                        className="flex items-center justify-between gap-3 p-4"
                      >
                        <div>
                          <p className="font-medium">{payslip.runTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            {payslip.periodEnd
                              ? new Date(payslip.periodEnd).toLocaleDateString()
                              : payslip.employeeName}
                            {payslip.paidAt
                              ? ` · Paid ${new Date(payslip.paidAt).toLocaleDateString()}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Published</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDownloadPayslip(payslip)}
                          >
                            <Download className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { EmployeeDetailForm } from "../../../hooks/use-employee-detail-form";

interface DocumentsTabProps {
  form: EmployeeDetailForm;
}

export function DocumentsTab({ form }: DocumentsTabProps) {
  const { employee } = form;

  return (
    <TabsContent value="documents">
      <Card>
        <CardHeader>
          <CardTitle>Documents & Files</CardTitle>
          <CardDescription>View and manage employee documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Employee Documents</h4>
              <Button variant="outline" size="sm">
                Upload New
              </Button>
            </div>

            <div className="border rounded-lg divide-y">
              {employee.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.type} • Added on {doc.dateUploaded}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{doc.status}</Badge>
                    <Button variant="ghost" size="icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

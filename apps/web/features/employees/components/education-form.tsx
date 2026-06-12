import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ToastMessage } from "@/components/toast-message";

// Form schema for education
const formSchema = z.object({
  degree: z
    .string()
    .min(2, { message: "Degree must be at least 2 characters" }),
  institution: z.string().min(2, { message: "Institution is required" }),
  year: z.string().min(4, { message: "Year is required" }),
  field: z.string().optional(),
  grade: z.string().optional(),
  description: z.string().optional(),
});

export type EducationFormValues = z.infer<typeof formSchema>;

interface EducationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (values: EducationFormValues) => void;
  defaultValues?: Partial<EducationFormValues>;
  editMode?: boolean;
}

export function EducationForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  editMode = false,
}: EducationFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const initialValues = {
    degree: "",
    institution: "",
    year: "",
    field: "",
    grade: "",
    description: "",
    ...defaultValues,
  };

  const form = useForm<EducationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  const handleSubmit = async (values: EducationFormValues) => {
    setIsLoading(true);
    try {
      // Here you would typically submit to an API
      console.log(values);

      if (onSubmit) {
        onSubmit(values);
      }

      toast.success(
        <ToastMessage
          title={editMode ? "Education Updated" : "Education Added"}
          description={
            editMode
              ? "Education has been updated."
              : "Education has been added to the employee record."
          }
        />,
      );

      onOpenChange(false);
      form.reset(initialValues);
    } catch (error) {
      console.error("Error saving education:", error);
      toast.error(
        <ToastMessage
          title="Error"
          description="Failed to save education. Please try again."
        />,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editMode ? "Edit Education" : "Add Education"}
          </DialogTitle>
          <DialogDescription>
            {editMode
              ? "Update the education information below."
              : "Add new education details for this employee."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="degree"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Degree/Certificate*</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Bachelor of Science, MBA"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="institution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institution*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., University of California"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year of Completion*</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2020" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="field"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field of Study (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Computer Science"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade/GPA (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 3.8/4.0, First Class"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Information (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional details about this education"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset(initialValues);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? "Saving..."
                  : editMode
                    ? "Update Education"
                    : "Add Education"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

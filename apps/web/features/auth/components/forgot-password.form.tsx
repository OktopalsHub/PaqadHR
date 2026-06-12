"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
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
import { ToastMessage } from "@/components/toast-message";
import { requestPasswordReset } from "@/lib/api/auth";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/schemas/auth";

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export const ForgotPasswordForm = ({ onBack }: ForgotPasswordFormProps) => {
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetMutation = useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      requestPasswordReset(input.email),
    onSuccess: () => {
      toast.success(
        <ToastMessage
          title="Reset link sent"
          description="Check your email for password reset instructions."
        />,
      );
    },
    onError: () => {
      toast.error(
        <ToastMessage
          title="Error"
          description="Failed to send reset email. Please try again."
        />,
      );
    },
  });

  if (resetMutation.isSuccess) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground mt-2">
            We sent password reset instructions to your inbox.
          </p>
        </div>
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="px-0">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to sign in
      </Button>

      <div>
        <h2 className="text-xl font-semibold">Forgot password?</h2>
        <p className="text-muted-foreground mt-2">
          Enter your email and we&apos;ll send reset instructions.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => resetMutation.mutate(values))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-11"
            disabled={resetMutation.isPending}
          >
            {resetMutation.isPending ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      </Form>
    </div>
  );
};

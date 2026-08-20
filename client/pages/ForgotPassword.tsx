import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, CheckCircle, Shield } from "lucide-react";
import { sendPasswordReset } from "@/lib/auth";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (!email.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordReset(email);

      setEmailSent(true);

      toast({
        title: "Reset Email Sent",
        description:
          "If an account with this email exists, you'll receive a password reset link.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error sending the reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setIsLoading(true);

    try {
      await sendPasswordReset(email);

      toast({
        title: "Email Resent",
        description: "Password reset email has been sent again.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to resend email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a reset link
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Password Reset</CardTitle>
            <CardDescription>
              {emailSent
                ? "Check your email for the reset link"
                : "Enter your email to receive a password reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!emailSent ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Email Sent!</strong>
                    <br />
                    We've sent a password reset link to <strong>{email}</strong>
                    . Please check your inbox and follow the instructions in the
                    email.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>
                      <strong>What to do next:</strong>
                    </p>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Check your email inbox for a message from us</li>
                      <li>Click the "Reset Password" link in the email</li>
                      <li>Create a new secure password</li>
                      <li>Sign in with your new password</li>
                    </ol>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>
                      <strong>Didn't receive the email?</strong>
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Check your spam/junk folder</li>
                      <li>Make sure you entered the correct email address</li>
                      <li>Wait a few minutes for the email to arrive</li>
                    </ul>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleResendEmail}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? "Resending..." : "Resend Email"}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Need help?{" "}
            <Link
              to="/support"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

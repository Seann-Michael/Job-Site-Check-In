import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Eye, EyeOff, Zap } from "lucide-react";
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || "/";

  const devBypass = (role: "admin" | "superadmin") => {
    const user =
      role === "superadmin"
        ? { id: "1", name: "Super Admin", email: "superadmin@projectlens.com", role: "superadmin" }
        : { id: "3", name: "Dev Admin", email: "admin@example.com", role: "admin" };
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("auth_token", "dev_bypass_token_" + Date.now());
    toast.success(`Dev bypass: signed in as ${user.name}`);
    navigate(role === "superadmin" ? "/super-admin" : "/admin/jobs", { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock authentication - in real app, validate against API
      if (email && password) {
        let user;
        if (email === "superadmin@projectlens.com") {
          user = {
            id: "1",
            name: "Super Admin",
            email: email,
            role: "superadmin",
          };
        } else if (email === "agency@marketingfirm.com") {
          user = {
            id: "2",
            name: "Business Owner",
            email: email,
            role: "agency",
            agencyId: "agency-001",
            agencyName: "Business Owner",
          };
        } else {
          user = {
            id: "3",
            name: "John Smith",
            email: email,
            role: "admin",
          };
        }

        localStorage.setItem("auth_user", JSON.stringify(user));
        localStorage.setItem("auth_token", "mock_jwt_token_" + Date.now());

        toast.success("Welcome back!");

        // Redirect based on user role
        if (user.role === "agency") {
          navigate("/agency/admin/dashboard", { replace: true });
        } else if (user.role === "superadmin") {
          navigate("/super-admin", { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        toast.error("Please enter your email and password");
      }
    } catch (error) {
      toast.error("Sign in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Camera className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">
              Welcome to Local GMB Booster
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Sign in to manage your construction projects
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">Demo Credentials:</p>
              <p>Email: admin@example.com</p>
              <p>Password: admin123</p>
              <p className="mt-2">
                For super admin: superadmin@projectlens.com
              </p>
              <p className="mt-1">For agency admin: agency@marketingfirm.com</p>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* DEV BYPASS — remove before production */}
          <div className="mt-6 border border-dashed border-yellow-400 rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950/20 space-y-2">
            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Dev Bypass — remove before launch
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-yellow-400 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-950/40"
                onClick={() => devBypass("admin")}
              >
                Skip Login → Admin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-yellow-400 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-950/40"
                onClick={() => devBypass("superadmin")}
              >
                Skip Login → Super Admin
              </Button>
            </div>
          </div>

          <div className="mt-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              <Link
                to="/forgot-password"
                className="text-primary hover:underline"
              >
                Forgot your password?
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline">
                Create Business Account
              </Link>{" "}
              or{" "}
              <Link
                to="/agency-signup"
                className="text-primary hover:underline"
              >
                Agency Account
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

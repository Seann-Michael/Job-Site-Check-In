import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USStatesSelect } from "@/components/ui/us-states-select";
import { getCurrentUser, signOut } from "@/lib/auth";
import { dataService } from "@/lib/dataService";
import { workspaceService } from "@/lib/workspaceService";

// Values of the public.business_category enum.
const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "restaurant", label: "Restaurant" },
  { value: "retail", label: "Retail" },
  { value: "healthcare", label: "Healthcare" },
  { value: "automotive", label: "Automotive" },
  { value: "real_estate", label: "Real Estate" },
  { value: "professional_services", label: "Professional Services" },
  { value: "home_services", label: "Home Services" },
  { value: "beauty_wellness", label: "Beauty & Wellness" },
  { value: "fitness", label: "Fitness" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [form, setForm] = useState({
    name: "",
    email: currentUser?.email ?? "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    category: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Business name is required.");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Business email is required.");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Business phone is required.");
      return;
    }
    if (!form.category) {
      toast.error("Please choose a business category.");
      return;
    }

    setSubmitting(true);
    try {
      // owner_id and account_id are set server-side (owner_id in createBusiness,
      // account_id by a DB trigger) — do NOT send account_id here.
      await dataService.createBusiness({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        category: form.category,
        address: {
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zipCode: form.zipCode.trim(),
        },
      });

      // Refresh workspace scoping so the new business is picked up.
      workspaceService.reset();
      await workspaceService.initialize();

      toast.success("Business created! Welcome aboard.");
      navigate("/admin/jobs", { replace: true });
    } catch (err) {
      toast.error(
        "Could not create your business: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 py-12 px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Set up your business</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us about your business to finish setting up your account.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
            <CardDescription>
              You can change all of this later in Settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Business Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Acme Plumbing LLC"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Business Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="hello@acme.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Business Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={form.street}
                  onChange={(e) => update("street", e.target.value)}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <USStatesSelect
                    value={form.state}
                    onValueChange={(value) => update("state", value)}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={form.zipCode}
                    onChange={(e) => update("zipCode", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category">Business Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => update("category", value)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold"
                disabled={submitting}
              >
                {submitting ? "Creating…" : "Create Business"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

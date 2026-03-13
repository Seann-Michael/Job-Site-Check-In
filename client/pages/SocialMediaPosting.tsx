import { AppLayout } from "@/components/AppLayout";
import { Megaphone } from "lucide-react";

export default function SocialMediaPosting() {
  return (
    <AppLayout
      title="Social Posting"
      breadcrumbs={[{ label: "Social Posting", href: "/admin/social-posting" }]}
    >
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="flex items-center justify-center h-20 w-20 rounded-full bg-primary/10">
          <Megaphone className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold tracking-tight">
            Something Great Is Coming
          </h2>
          <p className="text-muted-foreground">
            We're building a powerful social posting suite that will let you
            schedule, publish, and track content across all your platforms —
            directly from this dashboard. Stay tuned.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

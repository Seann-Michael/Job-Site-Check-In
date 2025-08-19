import React, { useState } from "react";
import { AgencyLayout } from "../components/AgencyLayout";
import { ClientAccessDashboard } from "../components/OAuth/ClientAccessDashboard";
import { StaticLinkGenerator } from "../components/OAuth/StaticLinkGenerator";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Plus, ArrowLeft } from "lucide-react";

type ViewState = "dashboard" | "create";

export default function AgencyClientAccess() {
  const [currentView, setCurrentView] = useState<ViewState>("dashboard");

  const handleCreateNew = () => {
    setCurrentView("create");
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
  };

  const handleLinkGenerated = (link: any, sessionId: string) => {
    // Show success message and redirect back to dashboard
    console.log("Link generated:", link, sessionId);
    setCurrentView("dashboard");
  };

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        {currentView === "dashboard" && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Client Access Management
                </h1>
                <p className="text-muted-foreground">
                  Create branded onboarding links for clients to connect their
                  marketing platforms
                </p>
              </div>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Onboarding Link
              </Button>
            </div>

            {/* Dashboard */}
            <ClientAccessDashboard onCreateNew={handleCreateNew} />
          </>
        )}

        {currentView === "create" && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToDashboard}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    Create Onboarding Link
                  </h1>
                  <p className="text-muted-foreground">
                    Generate a branded link for your client to connect their
                    platforms
                  </p>
                </div>
              </div>
            </div>

            {/* Link Generator */}
            <OnboardingLinkGenerator onLinkGenerated={handleLinkGenerated} />
          </>
        )}
      </div>
    </AgencyLayout>
  );
}

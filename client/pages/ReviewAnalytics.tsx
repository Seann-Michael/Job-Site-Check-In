// @ts-nocheck
import React from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReviewAnalyticsSection } from "@/components/ReviewAnalyticsSection";

export default function ReviewAnalytics() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-full px-4 py-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/reviews")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600 shrink-0" />
              Review Analytics
            </h1>
            <p className="text-muted-foreground text-sm">
              Google review growth and rating trends
            </p>
          </div>
        </div>

        <ReviewAnalyticsSection />
      </div>
    </AppLayout>
  );
}

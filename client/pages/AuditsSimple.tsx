import React from "react";
import { AppLayout } from "@/components/AppLayout";

export default function AuditsSimple() {
  return (
    <AppLayout
      title="Audits"
      description="Test audits page"
    >
      <div className="p-6">
        <h1 className="text-2xl font-bold">Audits Page - Simple Test</h1>
        <p>This is a simplified audits page to test if the basic structure works.</p>
      </div>
    </AppLayout>
  );
}

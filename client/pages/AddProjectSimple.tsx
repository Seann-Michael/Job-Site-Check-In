import React from "react";
import { AppLayout } from "@/components/AppLayout";

export default function AddProjectSimple() {
  return (
    <AppLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold">Add Project (Simple)</h1>
        <p>This is a simplified version to test if the issue is in the component itself.</p>
      </div>
    </AppLayout>
  );
}

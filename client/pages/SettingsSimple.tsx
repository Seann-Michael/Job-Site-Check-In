import React from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
  return (
    <AppLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <Card>
          <CardHeader>
            <CardTitle>Settings Page</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Settings page is working correctly.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

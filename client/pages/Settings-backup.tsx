// Backup of original Settings.tsx for debugging
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";

export default function Settings() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings - Debug Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Settings page is working! This is a simplified version to isolate issues.</p>
            <Button>Test Button</Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

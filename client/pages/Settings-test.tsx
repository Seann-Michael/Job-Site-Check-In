import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";

// Test each import individually
// import { UserManagementSystem } from "@/components/UserManagementSystem";
// import { BusinessPlacesSearch } from "@/components/GoogleMaps/BusinessPlacesSearch";

export default function Settings() {
  const [testValue, setTestValue] = useState("");

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings - Test Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="test">Test Input</Label>
                <Input 
                  id="test"
                  value={testValue}
                  onChange={(e) => setTestValue(e.target.value)}
                  placeholder="Test if basic components work"
                />
              </div>
              <Button onClick={() => console.log("Button clicked")}>
                Test Button: {testValue}
              </Button>
              <p>If you can see this, basic components are working.</p>
              {/* Uncomment below to test UserManagementSystem */}
              {/* <UserManagementSystem /> */}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

import React from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Building2 } from "lucide-react";

export default function AdminAddProjectSimple() {
  return (
    <AppLayout
      title="Add New Home Services Project"
      breadcrumbs={[
        { label: "Projects", href: "/admin/projects" },
        { label: "Add Project", href: "/admin/add-project" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Home Services Project Creation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-8">
              <Building2 className="h-16 w-16 mx-auto mb-4 text-blue-500" />
              <h3 className="text-lg font-semibold mb-2">
                Admin Add Project Page
              </h3>
              <p className="text-gray-600 mb-4">
                This is the new admin add project page specifically designed for home services businesses.
                It should show different project types like renovation, construction, repair, etc.
              </p>
              <p className="text-sm text-gray-500">
                This confirms the routing is working correctly for admin vs agency projects.
              </p>
              <Button className="mt-4">Test Button</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

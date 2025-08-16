import React from "react";

// Test imports one by one to isolate the issue
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Test each AppLayout import individually
// import { ContextualHeader } from "@/components/ContextualHeader";
// import { HeaderSearch } from "@/components/SmartSearch";
// import { ThemeToggle } from "@/components/ThemeProvider";
// import { AppNotifications } from "@/components/UpdateNotification";
// import { NotificationDropdown } from "@/components/NotificationDropdown";
// import { Footer } from "@/components/Footer";
// import { CreditProvider } from "@/components/CreditProvider";
// import { CreditDisplay } from "@/components/CreditDisplay";

export default function DebugTest() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Debug Test</h1>
      <p>Testing basic imports first</p>
      <Button>Test Button</Button>
      <Badge>Test Badge</Badge>
    </div>
  );
}

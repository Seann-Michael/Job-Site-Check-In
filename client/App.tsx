import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Suspense, lazy, useEffect } from "react";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { analytics } from "@/lib/analytics";

// Lazy load pages for better performance
// const Index = lazy(() => import("./pages/Index"));
// const AddProject = lazy(() => import("./pages/AddProject"));
// const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
// const EditProject = lazy(() => import("./pages/EditProject"));
// const Gallery = lazy(() => import("./pages/Gallery"));
// const Settings = lazy(() => import("./pages/MinimalTest"));
const Automation = lazy(() => import("./pages/Automation"));
// const Reports = lazy(() => import("./pages/Reports"));
// const Audits = lazy(() => import("./pages/Audits"));
// const Maps = lazy(() => import("./pages/Maps"));

// Import components directly to fix lazy loading issues
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Audits from "./pages/Audits";
import Tasks from "./pages/Tasks";
import Gallery from "./pages/Gallery";
import Index from "./pages/Index";
import AddProject from "./pages/AddProject";
import AdminAddProjectMinimal from "./pages/AdminAddProjectMinimal";
import ProjectDetail from "./pages/ProjectDetail";
import EditProject from "./pages/EditProject";
const GeoGridScan = lazy(() => import("./pages/GeoGridScan"));
const GridOverlayDemo = lazy(() => import("./pages/GridOverlayDemo"));
const GridMapDemo = lazy(() => import("./pages/GridMapDemo"));
const ScanHistory = lazy(() => import("./pages/ScanHistory"));
const AuditReport = lazy(() => import("./pages/AuditReport"));
const CreditPurchase = lazy(() => import("./pages/CreditPurchase"));
const CreditHistory = lazy(() => import("./pages/CreditHistory"));
const CreditAnalytics = lazy(() => import("./pages/CreditAnalytics"));
const ReportGenerator = lazy(() => import("./pages/BasicReportGenerator"));
const WorkflowBuilder = lazy(() => import("./pages/WorkflowBuilder"));
const AddressTest = lazy(() => import("./pages/AddressTest"));
const AppPages = lazy(() => import("./pages/AppPages"));

import SuperAdmin from "./pages/SuperAdmin";
import BusinessDetail from "./pages/BusinessDetail";
import BusinessManagement from "./pages/BusinessManagement";
import UserManagement from "./pages/UserManagement";
import { CrashLogs } from "./pages/CrashLogs";

import Profile from "./pages/Profile";
import PublicProject from "./pages/PublicProject";
import SignIn from "./pages/SignIn";
import NotFound from "./pages/NotFound";
import AgencyAdmin from "./pages/AgencyAdmin";
import AgencyClientManagement from "./pages/AgencyClientManagement";
import AddAgencyClient from "./pages/AddAgencyClient";
import AgencyCommission from "./pages/AgencyCommission";
import AgencyAnalytics from "./pages/AgencyAnalytics";
import AgencyReports from "./pages/AgencyReports";
import AgencyAudits from "./pages/AgencyAudits";
import AgencyBilling from "./pages/AgencyBilling";
import AgencyBusinessOwners from "./pages/AgencyBusinessOwners";
import AgencyAdminUsers from "./pages/AgencyAdminUsers";
import AgencySettings from "./pages/AgencySettings";
import AgencyBusinessOwnerDetail from "./pages/AgencyBusinessOwnerDetail";
import AgencyBusinessOwnerEdit from "./pages/AgencyBusinessOwnerEdit";
import AddAgencyAdminUser from "./pages/AddAgencyAdminUser";
import AgencyAdminUserDetail from "./pages/AgencyAdminUserDetail";
import AgencyAdminUserEdit from "./pages/AgencyAdminUserEdit";
import SuperAdminAgencyManagement from "./pages/SuperAdminAgencyManagement";
import SuperAdminSettings from "./pages/SuperAdminSettings";
import SuperAdminStaff from "./pages/SuperAdminStaff";
import Signup from "./pages/Signup";
import AgencySignup from "./pages/AgencySignup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Support from "./pages/Support";
import SupportTicketDetail from "./pages/SupportTicketDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import ReviewGate from "./pages/ReviewGate";
import AdminReviews from "./pages/AdminReviews";
import Ideas from "./pages/Ideas";
import IdeaDetail from "./pages/IdeaDetail";
import SuperAdminIdeas from "./pages/SuperAdminIdeas";
import SuperAdminBroadcast from "./pages/SuperAdminBroadcast";
import SuperAdminMessageTemplates from "./pages/SuperAdminMessageTemplates";
import SuperAdminAnalytics from "./pages/SuperAdminAnalytics";
import SuperAdminAutomation from "./pages/SuperAdminAutomation";
import SuperAdminSegmentation from "./pages/SuperAdminSegmentation";
import SuperAdminEmailIntegration from "./pages/SuperAdminEmailIntegration";
import SuperAdminAPI from "./pages/SuperAdminAPI";
import SuperAdminPerformance from "./pages/SuperAdminPerformance";
import SuperAdminQuality from "./pages/SuperAdminQuality";
import SuperAdminHelp from "./pages/SuperAdminHelp";
import SuperAdminSupport from "./pages/SuperAdminSupport";
import SuperAdminFinancial from "./pages/SuperAdminFinancial";
import SuperAdminUsers from "./pages/SuperAdminUsers";
import SuperAdminCommunications from "./pages/SuperAdminCommunications";
import { ComingSoon } from "./pages/ComingSoon";

// Agency Project Management imports
import AgencyProjects from "./pages/AgencyProjects";
import AgencyProjectCreate from "./pages/AgencyProjectCreate";
import AgencyProjectDetail from "./pages/AgencyProjectDetail";
import AgencyProjectEdit from "./pages/AgencyProjectEdit";

// Agency Task Management
import AgencyTasks from "./pages/AgencyTasks";
import TaskView from "./pages/TaskView";

const queryClient = new QueryClient();

// PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      console.log("Service Worker registered:", registration);
      try {
        analytics.track("service_worker_registered");
      } catch (error) {
        console.error("Analytics tracking failed:", error);
      }
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
      try {
        analytics.trackError(error);
      } catch (analyticsError) {
        console.error("Analytics error tracking failed:", analyticsError);
      }
    });
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="light" storageKey="local-seo-ranker-theme">
          <TooltipProvider>
            <Sonner />
            <Suspense
              fallback={
                <div className="min-h-screen bg-background">
                  <div className="container px-4 py-6">
                    <div className="animate-pulse space-y-6">
                      {/* Header skeleton */}
                      <div className="h-16 bg-muted rounded-lg"></div>

                      {/* Stats grid skeleton */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-24 bg-muted rounded-lg"
                          ></div>
                        ))}
                      </div>

                      {/* Content grid skeleton */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="space-y-3">
                            <div className="aspect-video bg-muted rounded-lg"></div>
                            <div className="space-y-2">
                              <div className="h-4 bg-muted rounded w-3/4"></div>
                              <div className="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              }
            >
              <Routes>
                {/* Public routes */}
                <Route path="/signin" element={<SignIn />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/agency-signup" element={<AgencySignup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/help" element={<KnowledgeBase />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                <Route path="/public/project/:id" element={<PublicProject />} />
                <Route path="/review/:id" element={<ReviewGate />} />
                <Route path="/review-demo" element={<ReviewGate />} />

                {/* Protected routes */}
                <Route
                  path="/admin/projects"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/add-project"
                  element={
                    <ProtectedRoute>
                      <AdminAddProjectMinimal />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/address-test"
                  element={
                    <ProtectedRoute>
                      <AddressTest />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/app-pages"
                  element={
                    <ProtectedRoute>
                      <AppPages />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/project/:id"
                  element={
                    <ProtectedRoute>
                      <ProjectDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/project/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EditProject />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/gallery"
                  element={
                    <ProtectedRoute>
                      <Gallery />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/reviews"
                  element={
                    <ProtectedRoute>
                      <AdminReviews />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ideas"
                  element={
                    <ProtectedRoute>
                      <Ideas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ideas/:id"
                  element={
                    <ProtectedRoute>
                      <IdeaDetail />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/automations"
                  element={
                    <ProtectedRoute>
                      <Automation />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/reports"
                  element={
                    <ProtectedRoute>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/audits"
                  element={
                    <ProtectedRoute>
                      <Audits />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/tasks"
                  element={
                    <ProtectedRoute>
                      <Tasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/maps"
                  element={<Navigate to="/admin/maps/geo-grid-scan" replace />}
                />
                <Route
                  path="/admin/maps/geo-grid-scan"
                  element={
                    <ProtectedRoute>
                      <GeoGridScan />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/grid-map-demo"
                  element={
                    <ProtectedRoute>
                      <GridMapDemo />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/maps/one-time-scan"
                  element={<Navigate to="/admin/maps/geo-grid-scan" replace />}
                />
                {/* Audits routes */}
                <Route
                  path="/admin/audits/one-time-scan"
                  element={<Navigate to="/admin/maps/geo-grid-scan" replace />}
                />
                <Route
                  path="/admin/maps/scan-history"
                  element={<Navigate to="/admin/audits/scan-history" replace />}
                />
                <Route
                  path="/admin/grid-demo"
                  element={
                    <ProtectedRoute>
                      <GridOverlayDemo />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/audits/scan-history"
                  element={
                    <ProtectedRoute>
                      <ScanHistory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/audits/report/:id"
                  element={
                    <ProtectedRoute>
                      <AuditReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/credits/purchase"
                  element={
                    <ProtectedRoute>
                      <CreditPurchase />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/credits/history"
                  element={
                    <ProtectedRoute>
                      <CreditHistory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/credits/analytics"
                  element={
                    <ProtectedRoute>
                      <CreditAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/report-generator"
                  element={
                    <ProtectedRoute>
                      <ReportGenerator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/workflow-builder"
                  element={
                    <ProtectedRoute>
                      <WorkflowBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/workflow-builder/:id"
                  element={
                    <ProtectedRoute>
                      <WorkflowBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/coming-soon"
                  element={
                    <ProtectedRoute>
                      <ComingSoon />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/super-admin"
                  element={
                    <ProtectedRoute>
                      <SuperAdmin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/businesses"
                  element={
                    <ProtectedRoute>
                      <BusinessManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/business/:businessId"
                  element={
                    <ProtectedRoute>
                      <BusinessDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/help"
                  element={
                    <ProtectedRoute>
                      <KnowledgeBase />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/crash-logs"
                  element={
                    <ProtectedRoute>
                      <CrashLogs />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/support"
                  element={
                    <ProtectedRoute>
                      <Support />
                    </ProtectedRoute>
                  }
                />

                {/* Agency Admin Routes */}
                <Route
                  path="/agency/admin/dashboard"
                  element={
                    <ProtectedRoute>
                      <AgencyAdmin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/clients"
                  element={
                    <ProtectedRoute>
                      <AgencyClientManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/clients/add"
                  element={
                    <ProtectedRoute>
                      <AddAgencyClient />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/commission"
                  element={
                    <ProtectedRoute>
                      <AgencyCommission />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/analytics"
                  element={
                    <ProtectedRoute>
                      <AgencyAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/reports"
                  element={
                    <ProtectedRoute>
                      <AgencyReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/audits"
                  element={
                    <ProtectedRoute>
                      <AgencyAudits />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/billing"
                  element={
                    <ProtectedRoute>
                      <AgencyBilling />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/business-owners"
                  element={
                    <ProtectedRoute>
                      <AgencyBusinessOwners />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/business-owners/add"
                  element={
                    <ProtectedRoute>
                      <AddAgencyClient />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/business-owners/:id"
                  element={
                    <ProtectedRoute>
                      <AgencyBusinessOwnerDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/business-owners/:id/edit"
                  element={
                    <ProtectedRoute>
                      <AgencyBusinessOwnerEdit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/admin-users"
                  element={
                    <ProtectedRoute>
                      <AgencyAdminUsers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/admin-users/add"
                  element={
                    <ProtectedRoute>
                      <AddAgencyAdminUser />
                    </ProtectedRoute>
                  }
                />
                {/* Legacy redirect for old AddAgencyAdminUser path */}
                <Route
                  path="/AddAgencyAdminUser"
                  element={
                    <Navigate to="/agency/admin/admin-users/add" replace />
                  }
                />
                <Route
                  path="/agency/admin/admin-users/:id"
                  element={
                    <ProtectedRoute>
                      <AgencyAdminUserDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/admin-users/:id/edit"
                  element={
                    <ProtectedRoute>
                      <AgencyAdminUserEdit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/settings"
                  element={
                    <ProtectedRoute>
                      <AgencySettings />
                    </ProtectedRoute>
                  }
                />

                {/* Agency Project Management Routes */}
                <Route
                  path="/agency/admin/projects"
                  element={
                    <ProtectedRoute>
                      <AgencyProjects />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/projects/create"
                  element={
                    <ProtectedRoute>
                      <AgencyProjectCreate />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/projects/:id"
                  element={
                    <ProtectedRoute>
                      <AgencyProjectDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/projects/:id/edit"
                  element={
                    <ProtectedRoute>
                      <AgencyProjectEdit />
                    </ProtectedRoute>
                  }
                />

                {/* Agency Task Management Routes */}
                <Route
                  path="/agency/admin/tasks"
                  element={
                    <ProtectedRoute>
                      <AgencyTasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/tasks/:taskId"
                  element={
                    <ProtectedRoute>
                      <TaskView />
                    </ProtectedRoute>
                  }
                />
                {/* Admin Tasks Routes */}
                <Route
                  path="/admin/tasks/:taskId"
                  element={
                    <ProtectedRoute>
                      <TaskView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency/admin/help"
                  element={
                    <ProtectedRoute>
                      <KnowledgeBase />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/agencies"
                  element={
                    <ProtectedRoute>
                      <SuperAdminAgencyManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/settings"
                  element={
                    <ProtectedRoute>
                      <SuperAdminSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/staff"
                  element={
                    <ProtectedRoute>
                      <SuperAdminStaff />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/ideas"
                  element={
                    <ProtectedRoute>
                      <SuperAdminIdeas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/broadcast"
                  element={
                    <ProtectedRoute>
                      <SuperAdminBroadcast />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/templates"
                  element={
                    <ProtectedRoute>
                      <SuperAdminMessageTemplates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/analytics"
                  element={
                    <ProtectedRoute>
                      <SuperAdminAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/automation"
                  element={
                    <ProtectedRoute>
                      <SuperAdminAutomation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/segments"
                  element={
                    <ProtectedRoute>
                      <SuperAdminSegmentation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/email"
                  element={
                    <ProtectedRoute>
                      <SuperAdminEmailIntegration />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/api"
                  element={
                    <ProtectedRoute>
                      <SuperAdminAPI />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/super-admin/performance"
                  element={
                    <ProtectedRoute>
                      <SuperAdminPerformance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/quality"
                  element={
                    <ProtectedRoute>
                      <SuperAdminQuality />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/help"
                  element={
                    <ProtectedRoute>
                      <SuperAdminHelp />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/support"
                  element={
                    <ProtectedRoute>
                      <SuperAdminSupport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/financial"
                  element={
                    <ProtectedRoute>
                      <SuperAdminFinancial />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/users"
                  element={
                    <ProtectedRoute>
                      <SuperAdminUsers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/communications"
                  element={
                    <ProtectedRoute>
                      <SuperAdminCommunications />
                    </ProtectedRoute>
                  }
                />

                {/* Legacy/manual route redirects */}
                <Route
                  path="/"
                  element={<Navigate to="/admin/projects" replace />}
                />
                <Route
                  path="/dashboard"
                  element={<Navigate to="/admin/projects" replace />}
                />
                <Route
                  path="/admin/dashboard"
                  element={<Navigate to="/admin/projects" replace />}
                />
                <Route
                  path="/add-project"
                  element={<Navigate to="/admin/add-project" replace />}
                />
                <Route
                  path="/gallery"
                  element={<Navigate to="/admin/gallery" replace />}
                />
                <Route
                  path="/settings"
                  element={<Navigate to="/admin/settings" replace />}
                />
                <Route
                  path="/profile"
                  element={<Navigate to="/admin/profile" replace />}
                />
                <Route
                  path="/users"
                  element={<Navigate to="/admin/settings" replace />}
                />
                <Route
                  path="/photos"
                  element={<Navigate to="/admin/gallery" replace />}
                />
                <Route
                  path="/OneTimeScan"
                  element={<Navigate to="/admin/maps/geo-grid-scan" replace />}
                />

                {/* Builder.io compatibility routes (URLs without separators) */}
                <Route
                  path="/AddProject"
                  element={<Navigate to="/admin/add-project" replace />}
                />
                <Route
                  path="/AddAgencyClient"
                  element={
                    <Navigate to="/agency/admin/business-owners/add" replace />
                  }
                />

                {/* Auth and Public Routes */}
                <Route
                  path="/SignIn"
                  element={<Navigate to="/signin" replace />}
                />
                <Route
                  path="/Login"
                  element={<Navigate to="/login" replace />}
                />
                <Route
                  path="/SignUp"
                  element={<Navigate to="/signup" replace />}
                />
                <Route
                  path="/AgencySignup"
                  element={<Navigate to="/agency-signup" replace />}
                />
                <Route
                  path="/ForgotPassword"
                  element={<Navigate to="/forgot-password" replace />}
                />
                <Route
                  path="/KnowledgeBase"
                  element={<Navigate to="/knowledge-base" replace />}
                />

                {/* Additional Admin Routes */}
                <Route
                  path="/AddressTest"
                  element={<Navigate to="/admin/address-test" replace />}
                />
                <Route
                  path="/AppPages"
                  element={<Navigate to="/admin/app-pages" replace />}
                />
                <Route
                  path="/CrashLogs"
                  element={<Navigate to="/admin/crash-logs" replace />}
                />
                <Route
                  path="/AdminProjects"
                  element={<Navigate to="/admin/projects" replace />}
                />
                <Route
                  path="/AdminGallery"
                  element={<Navigate to="/admin/gallery" replace />}
                />
                <Route
                  path="/AdminSettings"
                  element={<Navigate to="/admin/settings" replace />}
                />
                <Route
                  path="/AdminReviews"
                  element={<Navigate to="/admin/reviews" replace />}
                />
                <Route
                  path="/AdminReports"
                  element={<Navigate to="/admin/reports" replace />}
                />
                <Route
                  path="/AdminAudits"
                  element={<Navigate to="/admin/audits" replace />}
                />
                <Route
                  path="/AdminTasks"
                  element={<Navigate to="/admin/tasks" replace />}
                />
                <Route
                  path="/AgencyAdmin"
                  element={<Navigate to="/agency/admin/dashboard" replace />}
                />
                <Route
                  path="/AgencyProjects"
                  element={<Navigate to="/agency/admin/projects" replace />}
                />
                <Route
                  path="/AgencyClients"
                  element={
                    <Navigate to="/agency/admin/business-owners" replace />
                  }
                />
                <Route
                  path="/AgencyClientManagement"
                  element={<Navigate to="/agency/admin/clients" replace />}
                />
                <Route
                  path="/AgencySettings"
                  element={<Navigate to="/agency/admin/settings" replace />}
                />
                <Route
                  path="/AgencyAnalytics"
                  element={<Navigate to="/agency/admin/analytics" replace />}
                />
                <Route
                  path="/AgencyReports"
                  element={<Navigate to="/agency/admin/reports" replace />}
                />
                <Route
                  path="/AgencyBilling"
                  element={<Navigate to="/agency/admin/billing" replace />}
                />
                <Route
                  path="/AgencyCommission"
                  element={<Navigate to="/agency/admin/commission" replace />}
                />
                <Route
                  path="/AgencyAudits"
                  element={<Navigate to="/agency/admin/audits" replace />}
                />
                <Route
                  path="/AgencyTasks"
                  element={<Navigate to="/agency/admin/tasks" replace />}
                />
                <Route
                  path="/AgencyProjectCreate"
                  element={
                    <Navigate to="/agency/admin/projects/create" replace />
                  }
                />
                <Route
                  path="/AgencyProjectDetail"
                  element={<Navigate to="/agency/admin/projects" replace />}
                />
                <Route
                  path="/AgencyProjectEdit"
                  element={<Navigate to="/agency/admin/projects" replace />}
                />
                <Route
                  path="/ScanHistory"
                  element={<Navigate to="/admin/audits/scan-history" replace />}
                />
                <Route
                  path="/CreditPurchase"
                  element={<Navigate to="/admin/credits/purchase" replace />}
                />
                <Route
                  path="/CreditHistory"
                  element={<Navigate to="/admin/credits/history" replace />}
                />
                <Route
                  path="/CreditAnalytics"
                  element={<Navigate to="/admin/credits/analytics" replace />}
                />
                <Route
                  path="/ReportGenerator"
                  element={<Navigate to="/admin/report-generator" replace />}
                />
                <Route
                  path="/GridOverlayDemo"
                  element={<Navigate to="/admin/grid-demo" replace />}
                />
                <Route
                  path="/OneTimeScan"
                  element={<Navigate to="/admin/maps/geo-grid-scan" replace />}
                />
                <Route
                  path="/AuditReport"
                  element={<Navigate to="/admin/audits" replace />}
                />
                <Route
                  path="/WorkflowBuilder"
                  element={<Navigate to="/admin/workflow-builder" replace />}
                />
                <Route
                  path="/AdminAutomations"
                  element={<Navigate to="/admin/automations" replace />}
                />
                <Route
                  path="/Profile"
                  element={<Navigate to="/admin/profile" replace />}
                />
                <Route
                  path="/Ideas"
                  element={<Navigate to="/ideas" replace />}
                />
                <Route
                  path="/IdeaDetail"
                  element={<Navigate to="/ideas" replace />}
                />
                <Route
                  path="/ComingSoon"
                  element={<Navigate to="/coming-soon" replace />}
                />
                <Route
                  path="/Support"
                  element={<Navigate to="/support" replace />}
                />

                {/* Super Admin Compatibility Routes */}
                <Route
                  path="/SuperAdmin"
                  element={<Navigate to="/super-admin" replace />}
                />
                <Route
                  path="/SuperAdminBusinesses"
                  element={<Navigate to="/super-admin/businesses" replace />}
                />
                <Route
                  path="/SuperAdminAgencies"
                  element={<Navigate to="/super-admin/agencies" replace />}
                />
                <Route
                  path="/SuperAdminSettings"
                  element={<Navigate to="/super-admin/settings" replace />}
                />
                <Route
                  path="/SuperAdminStaff"
                  element={<Navigate to="/super-admin/staff" replace />}
                />
                <Route
                  path="/SuperAdminIdeas"
                  element={<Navigate to="/super-admin/ideas" replace />}
                />
                <Route
                  path="/SuperAdminBroadcast"
                  element={<Navigate to="/super-admin/broadcast" replace />}
                />
                <Route
                  path="/SuperAdminAnalytics"
                  element={<Navigate to="/super-admin/analytics" replace />}
                />
                <Route
                  path="/SuperAdminAutomation"
                  element={<Navigate to="/super-admin/automation" replace />}
                />
                <Route
                  path="/SuperAdminAPI"
                  element={<Navigate to="/super-admin/api" replace />}
                />
                <Route
                  path="/SuperAdminPerformance"
                  element={<Navigate to="/super-admin/performance" replace />}
                />
                <Route
                  path="/SuperAdminSupport"
                  element={<Navigate to="/super-admin/support" replace />}
                />
                <Route
                  path="/SuperAdminUsers"
                  element={<Navigate to="/super-admin/users" replace />}
                />

                {/* Agency Admin Legacy URL Redirects */}
                <Route
                  path="/agency"
                  element={<Navigate to="/agency/admin/dashboard" replace />}
                />
                <Route
                  path="/agency-admin"
                  element={<Navigate to="/agency/admin/dashboard" replace />}
                />
                <Route
                  path="/agency-admin/clients"
                  element={
                    <Navigate to="/agency/admin/business-owners" replace />
                  }
                />
                <Route
                  path="/agency-admin/clients/:id"
                  element={
                    <Navigate to="/agency/admin/business-owners/:id" replace />
                  }
                />
                <Route
                  path="/agency-admin/billing"
                  element={<Navigate to="/agency/admin/billing" replace />}
                />
                <Route
                  path="/agency-admin/analytics"
                  element={<Navigate to="/agency/admin/analytics" replace />}
                />
                <Route
                  path="/agency-admin/settings"
                  element={<Navigate to="/agency/admin/settings" replace />}
                />
                <Route
                  path="/agency-admin/business-owners"
                  element={
                    <Navigate to="/agency/admin/business-owners" replace />
                  }
                />
                <Route
                  path="/agency-admin/business-owners/add"
                  element={
                    <Navigate to="/agency/admin/business-owners/add" replace />
                  }
                />
                <Route
                  path="/agency-admin/business-owners/:id"
                  element={
                    <Navigate to="/agency/admin/business-owners/:id" replace />
                  }
                />
                <Route
                  path="/agency-admin/business-owners/:id/edit"
                  element={
                    <Navigate
                      to="/agency/admin/business-owners/:id/edit"
                      replace
                    />
                  }
                />
                <Route
                  path="/agency-admin/admin-users"
                  element={<Navigate to="/agency/admin/admin-users" replace />}
                />
                <Route
                  path="/agency-admin/admin-users/add"
                  element={
                    <Navigate to="/agency/admin/admin-users/add" replace />
                  }
                />
                <Route
                  path="/agency-admin/admin-users/:id"
                  element={
                    <Navigate to="/agency/admin/admin-users/:id" replace />
                  }
                />
                <Route
                  path="/agency-admin/admin-users/:id/edit"
                  element={
                    <Navigate to="/agency/admin/admin-users/:id/edit" replace />
                  }
                />
                <Route
                  path="/agency-admin/commission"
                  element={<Navigate to="/agency/admin/commission" replace />}
                />
                <Route
                  path="/agency-admin/reports"
                  element={<Navigate to="/agency/admin/reports" replace />}
                />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Suspense, lazy, useEffect } from "react";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { analytics } from "@/lib/analytics";
import { queryClient } from "@/lib/queryClient";
import TestPage from "./pages/TestPage";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const AddProject = lazy(() => import("./pages/AddProject"));
const AdminAddProject = lazy(() => import("./pages/AdminAddProject"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const EditProject = lazy(() => import("./pages/EditProject"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Automation = lazy(() => import("./pages/Automation"));
const Settings = lazy(() => import("./pages/Settings"));
const WorkflowBuilder = lazy(() => import("./pages/WorkflowBuilder"));
const AppPages = lazy(() => import("./pages/AppPages"));

const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const BusinessDetail = lazy(() => import("./pages/BusinessDetail"));
const BusinessManagement = lazy(() => import("./pages/BusinessManagement"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const CrashLogs = lazy(() => import("./pages/CrashLogs"));
const PublicOnboarding = lazy(() => import("./pages/PublicOnboarding"));
const Tools = lazy(() => import("./pages/Tools"));
const Ideas = lazy(() => import("./pages/Ideas"));
const GMBOptimization = lazy(() => import("./pages/GMBOptimization"));
const SocialMediaPosting = lazy(() => import("./pages/SocialMediaPosting"));
const Payments = lazy(() => import("./pages/Payments"));

const Profile = lazy(() => import("./pages/Profile"));
const PublicProject = lazy(() => import("./pages/PublicProject"));
const SignIn = lazy(() => import("./pages/SignIn"));
const NotFound = lazy(() => import("./pages/NotFound"));

const SuperAdminSettings = lazy(() => import("./pages/SuperAdminSettings"));
const SuperAdminStaff = lazy(() => import("./pages/SuperAdminStaff"));
const Signup = lazy(() => import("./pages/Signup"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Support = lazy(() => import("./pages/Support"));
const SupportTicketDetail = lazy(() => import("./pages/SupportTicketDetail"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const ReviewGate = lazy(() => import("./pages/ReviewGate"));
const AdminReviews = lazy(() => import("./pages/AdminReviews"));
const ReviewDetail = lazy(() => import("./pages/ReviewDetail"));
const IdeaDetail = lazy(() => import("./pages/IdeaDetail"));
const SuperAdminIdeas = lazy(() => import("./pages/SuperAdminIdeas"));
const SuperAdminBroadcast = lazy(() => import("./pages/SuperAdminBroadcast"));
const SuperAdminMessageTemplates = lazy(
  () => import("./pages/SuperAdminMessageTemplates"),
);
const SuperAdminAnalytics = lazy(() => import("./pages/SuperAdminAnalytics"));
const SuperAdminAutomation = lazy(() => import("./pages/SuperAdminAutomation"));
const SuperAdminSegmentation = lazy(
  () => import("./pages/SuperAdminSegmentation"),
);
const SuperAdminEmailIntegration = lazy(
  () => import("./pages/SuperAdminEmailIntegration"),
);
const SuperAdminAPI = lazy(() => import("./pages/SuperAdminAPI"));
const SuperAdminPerformance = lazy(
  () => import("./pages/SuperAdminPerformance"),
);
const SuperAdminQuality = lazy(() => import("./pages/SuperAdminQuality"));
const SuperAdminHelp = lazy(() => import("./pages/SuperAdminHelp"));
const SuperAdminSupport = lazy(() => import("./pages/SuperAdminSupport"));
const SuperAdminUsers = lazy(() => import("./pages/SuperAdminUsers"));
const SuperAdminCommunications = lazy(
  () => import("./pages/SuperAdminCommunications"),
);
const ComingSoon = lazy(() => import("./pages/ComingSoon"));

// Lead Management
const SuperAdminLeads = lazy(() => import("./pages/SuperAdminLeads"));

// Service Worker registration is handled in index.html to avoid duplicates

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
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/help" element={<KnowledgeBase />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                <Route path="/public/project/:id" element={<PublicProject />} />
                <Route path="/review/:id" element={<ReviewGate />} />
                <Route path="/review-demo" element={<ReviewGate />} />
                <Route
                  path="/onboard/agency/:agencyToken"
                  element={<PublicOnboarding />}
                />
                <Route
                  path="/PublicOnboarding"
                  element={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="text-center space-y-4 max-w-md mx-auto p-6">
                        <h1 className="text-2xl font-bold text-foreground">
                          Invalid Onboarding Link
                        </h1>
                        <p className="text-muted-foreground">
                          This onboarding link is invalid or incomplete. Please
                          use the complete link provided by your agency.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Onboarding links should look like:{" "}
                          <code>/onboard/agency/your-agency-token</code>
                        </p>
                      </div>
                    </div>
                  }
                />
                <Route
                  path="/Public/Onboarding"
                  element={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="text-center space-y-4 max-w-md mx-auto p-6">
                        <h1 className="text-2xl font-bold text-foreground">
                          Invalid Onboarding Link
                        </h1>
                        <p className="text-muted-foreground">
                          This onboarding link is invalid or incomplete. Please
                          use the complete link provided by your agency.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Onboarding links should look like:{" "}
                          <code>/onboard/agency/your-agency-token</code>
                        </p>
                      </div>
                    </div>
                  }
                />
                <Route
                  path="/public/onboarding"
                  element={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="text-center space-y-4 max-w-md mx-auto p-6">
                        <h1 className="text-2xl font-bold text-foreground">
                          Invalid Onboarding Link
                        </h1>
                        <p className="text-muted-foreground">
                          This onboarding link is invalid or incomplete. Please
                          use the complete link provided by your agency.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Onboarding links should look like:{" "}
                          <code>/onboard/agency/your-agency-token</code>
                        </p>
                      </div>
                    </div>
                  }
                />
                <Route
                  path="/onboarding"
                  element={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="text-center space-y-4 max-w-md mx-auto p-6">
                        <h1 className="text-2xl font-bold text-foreground">
                          Invalid Onboarding Link
                        </h1>
                        <p className="text-muted-foreground">
                          This onboarding link is invalid or incomplete. Please
                          use the complete link provided by your agency.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Onboarding links should look like:{" "}
                          <code>/onboard/agency/your-agency-token</code>
                        </p>
                      </div>
                    </div>
                  }
                />
                <Route
                  path="/Ideas"
                  element={<Navigate to="/admin/ideas" replace />}
                />
                <Route
                  path="/GMBOptimization"
                  element={<Navigate to="/admin/gmb-optimization" replace />}
                />
                <Route
                  path="/onboard/:token"
                  element={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="text-center space-y-4 max-w-md mx-auto p-6">
                        <h1 className="text-2xl font-bold text-foreground">
                          Onboarding Link Format Changed
                        </h1>
                        <p className="text-muted-foreground">
                          This appears to be an old onboarding link format.
                          Please request a new onboarding link from your agency.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          The new onboarding system uses static, reusable links
                          that can be shared with multiple clients.
                        </p>
                      </div>
                    </div>
                  }
                />
                <Route
                  path="/onboard/*"
                  element={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                      <div className="text-center space-y-4 max-w-md mx-auto p-6">
                        <h1 className="text-2xl font-bold text-foreground">
                          Invalid Onboarding Link
                        </h1>
                        <p className="text-muted-foreground">
                          This onboarding link is invalid or incomplete. Please
                          check the link provided by your agency.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Valid onboarding links should include an agency token.
                        </p>
                      </div>
                    </div>
                  }
                />

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
                      <AdminAddProject />
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
                  path="/admin/reviews/:id"
                  element={
                    <ProtectedRoute>
                      <ReviewDetail />
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
                  path="/admin/payments"
                  element={
                    <ProtectedRoute>
                      <Payments />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/gmb-optimization"
                  element={
                    <ProtectedRoute>
                      <Suspense fallback={<div>Loading...</div>}>
                        <GMBOptimization />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/social-posting"
                  element={
                    <ProtectedRoute>
                      <Suspense fallback={<div>Loading...</div>}>
                        <SocialMediaPosting />
                      </Suspense>
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
                  path="/admin/ideas"
                  element={
                    <ProtectedRoute>
                      <Ideas />
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
                <Route
                  path="/super-admin/leads"
                  element={
                    <ProtectedRoute>
                      <SuperAdminLeads />
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
                  path="/admin"
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

                {/* Builder.io compatibility routes (URLs without separators) */}
                <Route
                  path="/AddProject"
                  element={<Navigate to="/admin/add-project" replace />}
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
                  path="/ForgotPassword"
                  element={<Navigate to="/forgot-password" replace />}
                />
                <Route
                  path="/KnowledgeBase"
                  element={<Navigate to="/knowledge-base" replace />}
                />

                {/* Additional Admin Routes */}
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
                  element={<Navigate to="/admin/ideas" replace />}
                />
                <Route
                  path="/IdeaDetail"
                  element={<Navigate to="/admin/ideas" replace />}
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
                  path="/SuperAdminQuality"
                  element={<Navigate to="/super-admin/quality" replace />}
                />
                <Route
                  path="/SuperAdminSupport"
                  element={<Navigate to="/super-admin/support" replace />}
                />
                <Route
                  path="/SuperAdminUsers"
                  element={<Navigate to="/super-admin/users" replace />}
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

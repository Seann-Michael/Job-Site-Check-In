import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Bug,
  Shield,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showErrorDetails: boolean;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showErrorDetails: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  private isCriticalError(error: Error): boolean {
    // List of non-critical error patterns that shouldn't trigger error boundary
    const nonCriticalPatterns = [
      /ResizeObserver.*delivered/i,
      /Non-passive event listener/i,
      /Warning:/i,
      /validateDOMNesting/i,
      /Cannot update a component/i,
      /render method/i,
      /unstable_/i,
    ];

    const errorMessage = error.message || "";
    const errorStack = error.stack || "";

    // If error matches any non-critical pattern, it's not critical
    for (const pattern of nonCriticalPatterns) {
      if (pattern.test(errorMessage) || pattern.test(errorStack)) {
        return false;
      }
    }

    // If error is a simple reference error and contains common safe keywords, not critical
    if (error.name === "ReferenceError" &&
        (errorMessage.includes("window") || errorMessage.includes("document"))) {
      return false;
    }

    // Default to treating as critical
    return true;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if this is a critical error or just a warning/minor issue
    const isCriticalError = this.isCriticalError(error);

    if (!isCriticalError) {
      // For non-critical errors, just log and don't show error boundary
      console.warn("Non-critical error caught (not displaying error boundary):", error);
      this.setState({ hasError: false, error: null, errorInfo: null });
      return;
    }

    this.setState({ errorInfo });

    // Enhanced error logging for debugging
    console.error("ERROR BOUNDARY CAUGHT AN ERROR:", error);
    console.error("Error Details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      errorInfo: errorInfo,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });

    // Only show toast for critical errors
    toast.error(`ERROR: ${error.message.substring(0, 100)}...`, {
      duration: 10000,
      description: `Check console for full details. Page: ${window.location.pathname}`
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Report to error tracking service (in production)
    this.reportErrorToService(error, errorInfo);

    // Show toast notification for non-critical errors
    if (!this.isCriticalError(error)) {
      toast.error("Something went wrong, but we're handling it!");
    }
  }


  private reportErrorToService(error: Error, errorInfo: ErrorInfo) {
    // In production, report to Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === "production") {
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  private handleRetry = () => {
    const { retryCount } = this.state;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showErrorDetails: false,
        retryCount: retryCount + 1,
      });

      // Reset retry count after successful render
      this.retryTimeoutId = setTimeout(() => {
        this.setState({ retryCount: 0 });
      }, 30000); // Reset after 30 seconds
    } else {
      toast.error("Maximum retry attempts reached. Please refresh the page.");
    }
  };

  private handleRefreshPage = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/admin/projects";
  };

  private generateErrorReport = () => {
    const { error, errorInfo } = this.state;
    const timestamp = new Date().toISOString();
    const userAgent = navigator.userAgent;
    const url = window.location.href;

    return `Error Report - ${timestamp}

URL: ${url}
User Agent: ${userAgent}

Error Message: ${error?.message || "Unknown error"}

Stack Trace:
${error?.stack || "No stack trace available"}

Component Stack:
${errorInfo?.componentStack || "No component stack available"}

Additional Info:
- Retry Count: ${this.state.retryCount}
- Timestamp: ${timestamp}
- Page: ${window.location.pathname}
- Referrer: ${document.referrer || "Direct"}`;
  };

  private handleCopyError = async () => {
    try {
      const errorReport = this.generateErrorReport();
      await navigator.clipboard.writeText(errorReport);
      toast.success("Error details copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy error details");
    }
  };

  private handleCreateSupportTicket = () => {
    const errorReport = this.generateErrorReport();
    const encodedReport = encodeURIComponent(errorReport);

    // Navigate to support page with pre-filled error details
    const supportUrl = `/admin/help?action=create-ticket&subject=${encodeURIComponent("Error Report - " + new Date().toLocaleDateString())}&description=${encodedReport}`;
    window.location.href = supportUrl;
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showErrorDetails, retryCount } = this.state;
      const maxRetries = 3;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Error Detected</AlertTitle>
                <AlertDescription>
                  We've encountered an unexpected error. Don't worry, your data
                  is safe. You can try the actions below to resolve this issue.
                </AlertDescription>
              </Alert>

              {/* Error Actions */}
              <div className="grid gap-2">
                {retryCount < maxRetries ? (
                  <Button onClick={this.handleRetry} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again ({maxRetries - retryCount} attempts left)
                  </Button>
                ) : (
                  <Button
                    onClick={this.handleRefreshPage}
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page
                  </Button>
                )}

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
              </div>

              {/* Error Reporting Actions */}
              <div className="border-t pt-4">
                <div className="text-sm text-gray-600 mb-3 text-center">
                  Need help? Copy the error details or create a support ticket
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={this.handleCopyError}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Error
                  </Button>
                  <Button
                    onClick={this.handleCreateSupportTicket}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Support Ticket
                  </Button>
                </div>
              </div>

              {/* Error Details Toggle */}
              {this.props.showDetails !== false && (
                <div className="border-t pt-4">
                  <Button
                    onClick={() =>
                      this.setState({
                        showErrorDetails: !showErrorDetails,
                      })
                    }
                    variant="ghost"
                    size="sm"
                    className="w-full"
                  >
                    <Bug className="h-4 w-4 mr-2" />
                    {showErrorDetails ? "Hide" : "Show"} Technical Details
                    {showErrorDetails ? (
                      <ChevronUp className="h-4 w-4 ml-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-2" />
                    )}
                  </Button>

                  {showErrorDetails && (
                    <div className="mt-4 p-4 bg-gray-100 rounded-lg text-sm">
                      <div className="space-y-2">
                        <div>
                          <strong>Error:</strong>{" "}
                          <code className="text-red-600">
                            {error?.message || "Unknown error"}
                          </code>
                        </div>
                        <div>
                          <strong>Stack:</strong>
                          <pre className="mt-1 text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                            {error?.stack || "No stack trace available"}
                          </pre>
                        </div>
                        {errorInfo && (
                          <div>
                            <strong>Component Stack:</strong>
                            <pre className="mt-1 text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                              {errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for easy error boundary wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">,
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Async error boundary for handling async errors
export function AsyncErrorBoundary({ children }: { children: ReactNode }) {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setError(
        new Error(
          `Unhandled promise rejection: ${event.reason?.message || event.reason}`,
        ),
      );
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  if (error) {
    throw error;
  }

  return <>{children}</>;
}

// Safe component wrapper that handles common React errors
export function SafeComponent({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        fallback || (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <p className="text-red-800 text-sm">
              This component failed to load. Please try refreshing the page.
            </p>
          </div>
        )
      }
    >
      <AsyncErrorBoundary>{children}</AsyncErrorBoundary>
    </ErrorBoundary>
  );
}

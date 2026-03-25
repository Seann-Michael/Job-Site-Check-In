import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive opacity-70" />
          <div>
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {this.state.error?.message || "An unexpected error occurred. Please try refreshing the page."}
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Safe wrapper around JSON.parse(localStorage.getItem(...))
 * Returns `defaultValue` on any error instead of throwing.
 */
export function safeLocalStorageParse<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[safeLocalStorageParse] Failed to parse localStorage key: "${key}". Returning default.`);
    return defaultValue;
  }
}

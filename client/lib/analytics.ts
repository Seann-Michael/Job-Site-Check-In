import { captureMessage } from "./errorHandling";
import { getCurrentUser } from "./auth";

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  url: string;
  userAgent: string;
}

interface UserEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId: string;
  url: string;
}

interface ErrorEvent {
  message: string;
  stack?: string;
  url: string;
  timestamp: number;
  userAgent: string;
  userId?: string;
  sessionId: string;
}

class AnalyticsService {
  private sessionId: string;
  private userId?: string;
  private isEnabled: boolean = true;
  private eventQueue: UserEvent[] = [];
  private performanceQueue: PerformanceMetric[] = [];
  private errorQueue: ErrorEvent[] = [];
  private flushInterval: number = 10000; // 10 seconds

  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = this.getUserId();
    this.init();
  }

  private init() {
    try {
      // Check if we're in a browser environment
      if (typeof window === "undefined" || typeof document === "undefined") {
        this.isEnabled = false;
        return;
      }

      // Check if analytics is enabled (GDPR compliance)
      this.isEnabled = localStorage.getItem("analytics-enabled") !== "false";

      if (!this.isEnabled) return;

      // Set up automatic flushing
      setInterval(() => this.flush(), this.flushInterval);

      // Track page views automatically
      this.trackPageView();

      // Set up basic error tracking
      this.setupErrorTracking();

      // Flush on page unload
      window.addEventListener("beforeunload", () => this.flush());
    } catch (error) {
      console.error("Analytics initialization failed:", error);
      this.isEnabled = false;
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUserId(): string | undefined {
    try {
      if (typeof window === "undefined") return undefined;
      const user = getCurrentUser();
      return user ? String(user.id) : undefined;
    } catch {
      return undefined;
    }
  }

  private getCurrentUrl(): string {
    try {
      return typeof window !== "undefined" ? window.location.href : "";
    } catch {
      return "";
    }
  }

  private getUserAgent(): string {
    try {
      return typeof navigator !== "undefined" ? navigator.userAgent : "";
    } catch {
      return "";
    }
  }

  // Event tracking
  track(event: string, properties: Record<string, any> = {}): void {
    if (!this.isEnabled) return;

    try {
      const userEvent: UserEvent = {
        event,
        properties,
        timestamp: Date.now(),
        userId: this.userId,
        sessionId: this.sessionId,
        url: this.getCurrentUrl(),
      };

      this.eventQueue.push(userEvent);

      // If queue is full, flush immediately
      if (this.eventQueue.length >= 10) {
        this.flush();
      }
    } catch (error) {
      console.error("Event tracking failed:", error);
    }
  }

  // Page view tracking
  trackPageView(url?: string): void {
    if (!this.isEnabled) return;

    try {
      this.track("page_view", {
        url: url || this.getCurrentUrl(),
        title: typeof document !== "undefined" ? document.title : "",
        referrer: typeof document !== "undefined" ? document.referrer : "",
      });
    } catch (error) {
      console.error("Page view tracking failed:", error);
    }
  }

  // Performance tracking
  trackPerformance(name: string, value: number): void {
    if (!this.isEnabled) return;

    try {
      const metric: PerformanceMetric = {
        name,
        value,
        timestamp: Date.now(),
        url: this.getCurrentUrl(),
        userAgent: this.getUserAgent(),
      };

      this.performanceQueue.push(metric);
    } catch (error) {
      console.error("Performance tracking failed:", error);
    }
  }

  // Error tracking
  trackError(error: any, context: Record<string, any> = {}): void {
    if (!this.isEnabled) return;

    try {
      const errorEvent: ErrorEvent = {
        message: error?.message || String(error),
        stack: error?.stack,
        url: this.getCurrentUrl(),
        timestamp: Date.now(),
        userAgent: this.getUserAgent(),
        userId: this.userId,
        sessionId: this.sessionId,
        ...context,
      };

      this.errorQueue.push(errorEvent);

      // Flush errors immediately
      this.flush();
    } catch (flushError) {
      console.error("Error tracking failed:", flushError);
    }
  }

  // Basic error tracking setup
  private setupErrorTracking() {
    try {
      if (typeof window === "undefined") return;

      // Global error handler
      window.addEventListener("error", (event) => {
        this.trackError(event.error || event.message, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });

      // Unhandled promise rejections
      window.addEventListener("unhandledrejection", (event) => {
        this.trackError(event.reason, {
          type: "unhandled_promise_rejection",
        });
      });
    } catch (error) {
      console.error("Error tracking setup failed:", error);
    }
  }

  // Feature usage tracking
  trackFeatureUsage(feature: string, action: string, metadata: Record<string, any> = {}): void {
    this.track("feature_usage", {
      feature,
      action,
      ...metadata,
    });
  }

  // Conversion tracking
  trackConversion(goal: string, value?: number, metadata: Record<string, any> = {}): void {
    this.track("conversion", {
      goal,
      value,
      ...metadata,
    });
  }

  // User identification
  identify(userId: string, traits: Record<string, any> = {}): void {
    try {
      this.userId = userId;
      this.track("user_identified", {
        userId,
        traits,
      });
    } catch (error) {
      console.error("User identification failed:", error);
    }
  }

  // Data flushing
  private flush(): void {
    try {
      if (!this.isEnabled) return;

      // No analytics backend is wired up. Errors are forwarded to Sentry
      // when VITE_SENTRY_DSN is configured; events/metrics are dropped.
      if (import.meta.env.PROD) {
        this.errorQueue.forEach((e) =>
          captureMessage(e.message, "error", { stack: e.stack, url: e.url, userId: e.userId }),
        );
      }

      // Clear queues
      this.eventQueue = [];
      this.performanceQueue = [];
      this.errorQueue = [];
    } catch (error) {
      console.error("Analytics flush failed:", error);
    }
  }

  // Public methods for external use
  enable(): void {
    this.isEnabled = true;
    if (typeof window !== "undefined") {
      localStorage.setItem("analytics-enabled", "true");
    }
  }

  disable(): void {
    this.isEnabled = false;
    if (typeof window !== "undefined") {
      localStorage.setItem("analytics-enabled", "false");
    }
  }

  isAnalyticsEnabled(): boolean {
    return this.isEnabled;
  }
}

// Create singleton instance
let analyticsInstance: AnalyticsService;

// Export analytics functions
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    try {
      if (!analyticsInstance) {
        analyticsInstance = new AnalyticsService();
      }
      analyticsInstance.track(event, properties);
    } catch (error) {
      console.error("Analytics track failed:", error);
    }
  },

  trackPageView: (url?: string) => {
    try {
      if (!analyticsInstance) {
        analyticsInstance = new AnalyticsService();
      }
      analyticsInstance.trackPageView(url);
    } catch (error) {
      console.error("Analytics trackPageView failed:", error);
    }
  },

  trackError: (error: any, context?: Record<string, any>) => {
    try {
      if (!analyticsInstance) {
        analyticsInstance = new AnalyticsService();
      }
      analyticsInstance.trackError(error, context);
    } catch (trackingError) {
      console.error("Analytics trackError failed:", trackingError);
    }
  },

  trackFeatureUsage: (feature: string, action: string, metadata?: Record<string, any>) => {
    try {
      if (!analyticsInstance) {
        analyticsInstance = new AnalyticsService();
      }
      analyticsInstance.trackFeatureUsage(feature, action, metadata);
    } catch (error) {
      console.error("Analytics trackFeatureUsage failed:", error);
    }
  },

  identify: (userId: string, traits?: Record<string, any>) => {
    try {
      if (!analyticsInstance) {
        analyticsInstance = new AnalyticsService();
      }
      analyticsInstance.identify(userId, traits);
    } catch (error) {
      console.error("Analytics identify failed:", error);
    }
  },

  trackPerformance: (name: string, value: number) => {
    try {
      if (!analyticsInstance) {
        analyticsInstance = new AnalyticsService();
      }
      analyticsInstance.trackPerformance(name, value);
    } catch (error) {
      console.error("Analytics trackPerformance failed:", error);
    }
  },
};

// React hook for analytics
export function useAnalytics() {
  const track = (event: string, properties?: Record<string, any>) => {
    analytics.track(event, properties);
  };

  const trackPageView = (url?: string) => {
    analytics.trackPageView(url);
  };

  const trackFeatureUsage = (feature: string, action: string, metadata?: Record<string, any>) => {
    analytics.trackFeatureUsage(feature, action, metadata);
  };

  const trackError = (error: any, context?: Record<string, any>) => {
    analytics.trackError(error, context);
  };

  const trackPerformance = (name: string, value: number) => {
    analytics.trackPerformance(name, value);
  };

  return {
    track,
    trackPageView,
    trackFeatureUsage,
    trackError,
    trackPerformance,
  };
}

export default analytics;

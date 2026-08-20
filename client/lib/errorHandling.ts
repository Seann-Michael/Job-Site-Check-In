import { getCurrentUser } from "./auth";
// Comprehensive error handling and validation system

// ---------------------------------------------------------------------------
// Sentry hook. Enabled only when VITE_SENTRY_DSN is set; otherwise every
// function here is a no-op and @sentry/react is never loaded.
// ---------------------------------------------------------------------------
type SentryModule = typeof import("@sentry/react");
let sentryPromise: Promise<SentryModule | null> | null = null;

export function isSentryEnabled(): boolean {
  return !!(import.meta.env.VITE_SENTRY_DSN as string | undefined);
}

/** Lazily initialise Sentry. Resolves to null when no DSN is configured. */
export function initSentry(): Promise<SentryModule | null> {
  if (sentryPromise) return sentryPromise;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    sentryPromise = Promise.resolve(null);
    return sentryPromise;
  }
  sentryPromise = import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0,
      });
      return Sentry;
    })
    .catch((err) => {
      console.error("Failed to initialise Sentry:", err);
      return null;
    });
  return sentryPromise;
}

/** Report an error to Sentry if configured. Safe to call unconditionally. */
export function captureException(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  if (!isSentryEnabled()) return;
  void initSentry().then((Sentry) => {
    if (!Sentry) return;
    const err = error instanceof Error ? error : new Error(String(error));
    Sentry.captureException(err, extra ? { extra } : undefined);
  });
}

/** Report a plain message to Sentry if configured. */
export function captureMessage(
  message: string,
  level: "error" | "warning" | "info" | "debug" = "error",
  extra?: Record<string, unknown>,
): void {
  if (!isSentryEnabled()) return;
  void initSentry().then((Sentry) => {
    if (!Sentry) return;
    Sentry.captureMessage(message, { level, extra });
  });
}

export interface ErrorContext {
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp: string;
  component?: string;
  action?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorLog {
  id: string;
  level: "error" | "warning" | "info" | "debug";
  message: string;
  stack?: string;
  context: ErrorContext;
  resolved: boolean;
  frequency: number;
  lastOccurrence: string;
}

export class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs: number = 1000;
  private errorCounts: Map<string, number> = new Map();

  log(
    level: ErrorLog["level"],
    message: string,
    error?: Error,
    context?: Partial<ErrorContext>,
  ): void {
    const errorKey = this.generateErrorKey(message, error?.stack);
    const frequency = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, frequency + 1);

    const errorLog: ErrorLog = {
      id: this.generateId(),
      level,
      message,
      stack: error?.stack,
      context: {
        userId: this.getCurrentUserId(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        ...context,
      },
      resolved: false,
      frequency: frequency + 1,
      lastOccurrence: new Date().toISOString(),
    };

    this.logs.unshift(errorLog);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Send to external service in production
    this.sendToExternalService(errorLog);

    // Log to console for development
    this.logToConsole(errorLog);
  }

  error(message: string, error?: Error, context?: Partial<ErrorContext>): void {
    this.log("error", message, error, context);
  }

  warning(message: string, context?: Partial<ErrorContext>): void {
    this.log("warning", message, undefined, context);
  }

  info(message: string, context?: Partial<ErrorContext>): void {
    this.log("info", message, undefined, context);
  }

  debug(message: string, context?: Partial<ErrorContext>): void {
    this.log("debug", message, undefined, context);
  }

  getLogs(level?: ErrorLog["level"]): ErrorLog[] {
    if (level) {
      return this.logs.filter((log) => log.level === level);
    }
    return [...this.logs];
  }

  getUnresolvedErrors(): ErrorLog[] {
    return this.logs.filter((log) => log.level === "error" && !log.resolved);
  }

  resolveError(errorId: string): void {
    const log = this.logs.find((l) => l.id === errorId);
    if (log) {
      log.resolved = true;
    }
  }

  clearLogs(): void {
    this.logs = [];
    this.errorCounts.clear();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorKey(message: string, stack?: string): string {
    const stackLine = stack?.split("\n")[1] || "";
    return `${message}-${stackLine}`;
  }

  private getCurrentUserId(): string | undefined {
    try {
      const user = getCurrentUser();
      return user ? String(user.id) : undefined;
    } catch {
      return undefined;
    }
  }

  private sendToExternalService(errorLog: ErrorLog): void {
    if (!import.meta.env.PROD || errorLog.level !== "error") return;
    captureMessage(errorLog.message, "error", {
      stack: errorLog.stack,
      context: errorLog.context,
    });
  }

  private logToConsole(errorLog: ErrorLog): void {
    const consoleMethod =
      errorLog.level === "error"
        ? "error"
        : errorLog.level === "warning"
          ? "warn"
          : errorLog.level === "info"
            ? "info"
            : "debug";

    console[consoleMethod](
      `[${errorLog.level.toUpperCase()}] ${errorLog.message}`,
      {
        context: errorLog.context,
        stack: errorLog.stack,
        frequency: errorLog.frequency,
      },
    );
  }
}

// Validation system
export interface ValidationRule {
  id: string;
  name: string;
  type: "required" | "email" | "phone" | "url" | "custom";
  message: string;
  pattern?: RegExp;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class Validator {
  private rules: Map<string, ValidationRule[]> = new Map();

  addRule(field: string, rule: ValidationRule): void {
    const fieldRules = this.rules.get(field) || [];
    fieldRules.push(rule);
    this.rules.set(field, fieldRules);
  }

  addRules(field: string, rules: ValidationRule[]): void {
    this.rules.set(field, rules);
  }

  validate(data: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [field, value] of Object.entries(data)) {
      const fieldRules = this.rules.get(field) || [];

      for (const rule of fieldRules) {
        const isValid = this.validateRule(value, rule);
        if (!isValid) {
          if (rule.type === "required") {
            errors.push(rule.message);
          } else {
            warnings.push(rule.message);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateField(field: string, value: any): ValidationResult {
    const fieldRules = this.rules.get(field) || [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of fieldRules) {
      const isValid = this.validateRule(value, rule);
      if (!isValid) {
        if (rule.type === "required") {
          errors.push(rule.message);
        } else {
          warnings.push(rule.message);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateRule(value: any, rule: ValidationRule): boolean {
    switch (rule.type) {
      case "required":
        return value !== null && value !== undefined && value !== "";

      case "email":
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return !value || emailPattern.test(value);

      case "phone":
        const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
        return !value || phonePattern.test(value.replace(/\s/g, ""));

      case "url":
        try {
          new URL(value);
          return true;
        } catch {
          return !value;
        }

      case "custom":
        if (rule.pattern) {
          return !value || rule.pattern.test(value);
        }
        if (rule.validator) {
          return rule.validator(value);
        }
        return true;

      default:
        return true;
    }
  }

  clearRules(field?: string): void {
    if (field) {
      this.rules.delete(field);
    } else {
      this.rules.clear();
    }
  }
}

// Security utilities
export class SecurityValidator {
  static sanitizeInput(input: string): string {
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }

  static validateCSRF(token: string): boolean {
    // In a real implementation, validate against server-generated token
    return token.length > 10;
  }

  static detectXSS(content: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    ];

    return xssPatterns.some((pattern) => pattern.test(content));
  }

  static validateFileUpload(file: File): { isValid: boolean; error?: string } {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: "Invalid file type" };
    }

    if (file.size > maxSize) {
      return { isValid: false, error: "File too large" };
    }

    return { isValid: true };
  }
}

// Rate limiting
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private limits: Map<string, { max: number; window: number }> = new Map();

  setLimit(identifier: string, max: number, windowSeconds: number): void {
    this.limits.set(identifier, { max, window: windowSeconds * 1000 });
  }

  isAllowed(identifier: string, key: string = "default"): boolean {
    const limit = this.limits.get(identifier);
    if (!limit) return true;

    const requestKey = `${identifier}:${key}`;
    const now = Date.now();
    const requests = this.requests.get(requestKey) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter((time) => now - time < limit.window);

    if (validRequests.length >= limit.max) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(requestKey, validRequests);

    return true;
  }

  getRemainingRequests(identifier: string, key: string = "default"): number {
    const limit = this.limits.get(identifier);
    if (!limit) return Infinity;

    const requestKey = `${identifier}:${key}`;
    const now = Date.now();
    const requests = this.requests.get(requestKey) || [];
    const validRequests = requests.filter((time) => now - time < limit.window);

    return Math.max(0, limit.max - validRequests.length);
  }

  reset(identifier?: string, key?: string): void {
    if (identifier && key) {
      this.requests.delete(`${identifier}:${key}`);
    } else if (identifier) {
      for (const requestKey of this.requests.keys()) {
        if (requestKey.startsWith(`${identifier}:`)) {
          this.requests.delete(requestKey);
        }
      }
    } else {
      this.requests.clear();
    }
  }
}

// Error boundary utility for React components
export class ErrorBoundaryLogger {
  static logError(error: Error, errorInfo: any, componentStack?: string): void {
    globalErrorLogger.error(`React Error Boundary: ${error.message}`, error, {
      component: "ErrorBoundary",
      additionalData: { ...errorInfo, componentStack },
    });
  }
}

// Global instances
export const globalErrorLogger = new ErrorLogger();
export const globalValidator = new Validator();
export const globalRateLimiter = new RateLimiter();

// Set up global error handling
if (typeof window !== "undefined") {
  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    globalErrorLogger.error(
      "Unhandled Promise Rejection",
      new Error(event.reason),
      { action: "unhandledrejection" },
    );
  });

  // Handle uncaught errors
  window.addEventListener("error", (event) => {
    globalErrorLogger.error(
      `Uncaught Error: ${event.message}`,
      new Error(event.message),
      {
        action: "uncaughterror",
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      },
    );
  });

  // Set up default rate limits
  globalRateLimiter.setLimit("api", 100, 60); // 100 requests per minute
  globalRateLimiter.setLimit("broadcast", 10, 60); // 10 broadcasts per minute
  globalRateLimiter.setLimit("upload", 5, 60); // 5 uploads per minute
}

// Common validation rules
export const commonValidationRules = {
  email: {
    id: "email",
    name: "Email Validation",
    type: "email" as const,
    message: "Please enter a valid email address",
  },
  required: {
    id: "required",
    name: "Required Field",
    type: "required" as const,
    message: "This field is required",
  },
  phone: {
    id: "phone",
    name: "Phone Validation",
    type: "phone" as const,
    message: "Please enter a valid phone number",
  },
  url: {
    id: "url",
    name: "URL Validation",
    type: "url" as const,
    message: "Please enter a valid URL",
  },
};

import { captureException } from "./errorHandling";

// Type-safe utilities for improved reliability

// Safe array access
export function safeArrayAccess<T>(
  array: T[] | undefined | null,
  index: number,
  fallback?: T,
): T | undefined {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return fallback;
  }
  return array[index];
}

// Safe object property access
export function safeGet<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K,
  fallback?: T[K],
): T[K] | undefined {
  return obj?.[key] ?? fallback;
}

// Deep safe object access
export function deepGet<T = any>(
  obj: any,
  path: string | string[],
  fallback?: T,
): T {
  const keys = Array.isArray(path) ? path : path.split(".");
  let result = obj;

  for (const key of keys) {
    if (result == null || typeof result !== "object") {
      return fallback as T;
    }
    result = result[key];
  }

  return result ?? fallback;
}

// Safe JSON parsing
export function safeJsonParse<T = any>(
  json: string,
  fallback?: T,
): T | undefined {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// Safe localStorage operations
export const safeStorage = {
  get<T = any>(key: string, fallback?: T): T | undefined {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return fallback;
      }
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key: string, value: any): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      console.warn(`Failed to save to localStorage: ${key}`);
      return false;
    }
  },

  remove(key: string): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};

// Input validation utilities
export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  phone: (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  },

  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  notEmpty: (value: string): boolean => {
    return value.trim().length > 0;
  },

  minLength: (value: string, min: number): boolean => {
    return value.length >= min;
  },

  maxLength: (value: string, max: number): boolean => {
    return value.length <= max;
  },

  isNumber: (value: string): boolean => {
    return !isNaN(Number(value)) && isFinite(Number(value));
  },

  isPositiveNumber: (value: string): boolean => {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && num > 0;
  },

  isInteger: (value: string): boolean => {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && Number.isInteger(num);
  },

  dateRange: (startDate: string, endDate: string): boolean => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end;
  },
};

// Safe async operations
export async function safeAsync<T>(
  asyncFn: () => Promise<T>,
  fallback?: T,
  retries: number = 0,
): Promise<{ data?: T; error?: Error; success: boolean }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await asyncFn();
      return { data, success: true };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        );
      }
    }
  }

  return {
    data: fallback,
    error: lastError,
    success: false,
  };
}

// Type guards
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

// Error handling utilities
export class ApplicationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: Record<string, any>,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function createErrorHandler<T extends (...args: any[]) => any>(
  fn: T,
  errorMessage?: string,
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error) => {
          console.error(errorMessage || "An error occurred:", error);
          throw new ApplicationError(
            errorMessage || error.message,
            "HANDLED_ERROR",
            { originalError: error, args },
          );
        });
      }

      return result;
    } catch (error) {
      console.error(errorMessage || "An error occurred:", error);
      throw new ApplicationError(
        errorMessage ||
          (error instanceof Error ? error.message : String(error)),
        "HANDLED_ERROR",
        { originalError: error, args },
      );
    }
  }) as T;
}

// Retry utility with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {},
): Promise<T> {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === retries || !shouldRetry(lastError)) {
        throw lastError;
      }

      const waitTime = delay * Math.pow(backoff, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError!;
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new ApplicationError(
          "Circuit breaker is OPEN",
          "CIRCUIT_BREAKER_OPEN",
        );
      }
    }

    try {
      const result = await fn();

      if (this.state === "HALF_OPEN") {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
    }
  }

  private reset() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  getState() {
    return this.state;
  }
}

// Global error tracking
class ErrorTracker {
  private errors: Array<{
    error: Error;
    timestamp: number;
    context?: Record<string, any>;
  }> = [];

  track(error: Error, context?: Record<string, any>) {
    this.errors.push({
      error,
      timestamp: Date.now(),
      context,
    });

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    if (import.meta.env.PROD) {
      captureException(error, context);
    }
  }

  getErrors() {
    return [...this.errors];
  }

  getRecentErrors(minutes: number = 5) {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.errors.filter((entry) => entry.timestamp > cutoff);
  }

  clear() {
    this.errors = [];
  }
}

export const errorTracker = new ErrorTracker();

// Global uncaught error handler
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    errorTracker.track(event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
    errorTracker.track(error, { type: "unhandledrejection" });
  });
}

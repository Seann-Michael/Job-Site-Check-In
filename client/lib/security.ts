// Minimal security utilities to avoid module loading errors

// Basic CSRF Protection (simplified)
export class CSRFProtection {
  private static TOKEN_KEY = "csrf_token";
  private static HEADER_NAME = "X-CSRF-Token";

  static generateToken(): string {
    try {
      // Simple fallback token generation
      const token = Date.now().toString(36) + Math.random().toString(36);
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(this.TOKEN_KEY, token);
      }
      return token;
    } catch (error) {
      console.error("CSRF token generation failed:", error);
      return "fallback-token-" + Date.now();
    }
  }

  static getToken(): string | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return localStorage.getItem(this.TOKEN_KEY);
      }
      return null;
    } catch {
      return null;
    }
  }

  static addTokenToHeaders(
    headers: Record<string, string> = {},
  ): Record<string, string> {
    try {
      const token = this.getToken();
      if (token) {
        headers[this.HEADER_NAME] = token;
      }
      return headers;
    } catch {
      return headers;
    }
  }
}

// Simplified XSS Protection
export class XSSProtection {
  static escapeHtml(input: string): string {
    try {
      const div = document.createElement("div");
      div.textContent = input;
      return div.innerHTML;
    } catch {
      return input.replace(/[<>&"']/g, "");
    }
  }

  static sanitizeInput(input: string): string {
    try {
      return input
        .replace(/[<>]/g, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "")
        .trim();
    } catch {
      return "";
    }
  }
}

// Simplified Secure API (without session management to avoid errors)
export class SecureAPI {
  private static baseUrl = "/api";

  static async secureRequest(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    try {
      const url = `${this.baseUrl}${endpoint}`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };

      // Add basic security headers
      headers["X-Requested-With"] = "XMLHttpRequest";

      const secureOptions: RequestInit = {
        ...options,
        headers,
      };

      return await fetch(url, secureOptions);
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  static async get(endpoint: string): Promise<any> {
    try {
      const response = await this.secureRequest(endpoint, { method: "GET" });
      return response.json();
    } catch (error) {
      console.error("GET request failed:", error);
      throw error;
    }
  }

  static async post(endpoint: string, data: any): Promise<any> {
    try {
      const response = await this.secureRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.json();
    } catch (error) {
      console.error("POST request failed:", error);
      throw error;
    }
  }
}

// Minimal Secure Session Management (simplified to avoid errors)
export class SecureSession {
  private static SESSION_KEY = "secure_session";
  private static ACTIVITY_KEY = "last_activity";

  static createSession(userData: any, rememberMe: boolean = false): string {
    try {
      const sessionId = Date.now().toString(36) + Math.random().toString(36);
      const sessionData = {
        id: sessionId,
        user: userData,
        createdAt: Date.now(),
        rememberMe,
      };

      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
        this.updateActivity();
      }
      return sessionId;
    } catch (error) {
      console.error("Session creation failed:", error);
      return "fallback-session-" + Date.now();
    }
  }

  static validateSession(): {
    valid: boolean;
    user?: any;
    warningTime?: number;
  } {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return { valid: false };
      }

      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (!sessionData) {
        return { valid: false };
      }

      const session = JSON.parse(sessionData);
      return { valid: true, user: session.user };
    } catch (error) {
      console.error("Session validation failed:", error);
      return { valid: false };
    }
  }

  static updateActivity(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(this.ACTIVITY_KEY, Date.now().toString());
      }
    } catch (error) {
      console.error("Failed to update activity:", error);
    }
  }

  static extendSession(): void {
    try {
      // Simple implementation - just update activity
      this.updateActivity();
    } catch (error) {
      console.error("Failed to extend session:", error);
    }
  }

  static destroySession(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.ACTIVITY_KEY);
      }
    } catch (error) {
      console.error("Failed to destroy session:", error);
    }
  }
}

// Basic input validation
export class SecureInput {
  static validateEmail(email: string): { valid: boolean; error?: string } {
    try {
      if (!email) {
        return { valid: false, error: "Email is required" };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { valid: false, error: "Invalid email format" };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "Email validation failed" };
    }
  }

  static sanitizeFileName(fileName: string): string {
    try {
      return fileName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_{2,}/g, "_")
        .slice(0, 255);
    } catch {
      return "file";
    }
  }

  static validatePassword(password: string): { valid: boolean; errors?: string[]; error?: string } {
    try {
      const errors: string[] = [];

      if (!password) {
        return { valid: false, error: "Password is required" };
      }

      if (password.length < 8) {
        errors.push("Password must be at least 8 characters long");
      }

      if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
      }

      if (!/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
      }

      if (!/\d/.test(password)) {
        errors.push("Password must contain at least one number");
      }

      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push("Password must contain at least one special character");
      }

      if (errors.length > 0) {
        return { valid: false, errors, error: errors.join(", ") };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Password validation failed" };
    }
  }
}

// Minimal Audit Logger
export class AuditLogger {
  static log(
    action: string,
    resource: string,
    details?: any,
    userId?: string,
  ): void {
    try {
      console.log("Audit Log:", {
        action,
        resource,
        details,
        userId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Audit logging failed:", error);
    }
  }

  static getAuditLogs(): Array<any> {
    return [];
  }
}

// Minimal Security Monitor
export class SecurityMonitor {
  static logSecurityEvent(type: string, details: any): void {
    try {
      console.warn("Security Event:", { type, details, timestamp: Date.now() });
    } catch (error) {
      console.error("Security monitoring failed:", error);
    }
  }

  static getSecurityEvents(): Array<any> {
    return [];
  }
}

// Minimal Data Protection
export class DataProtection {
  static detectPII(text: string): { hasPII: boolean; types: string[] } {
    try {
      // Simple email detection
      const hasEmail =
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text);
      return {
        hasPII: hasEmail,
        types: hasEmail ? ["email"] : [],
      };
    } catch {
      return { hasPII: false, types: [] };
    }
  }

  static maskPII(text: string): string {
    try {
      return text.replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        "***@***.***",
      );
    } catch {
      return text;
    }
  }
}

// Initialize CSRF protection safely
if (typeof window !== "undefined") {
  try {
    CSRFProtection.generateToken();
  } catch (error) {
    console.error("Failed to initialize CSRF protection:", error);
  }
}

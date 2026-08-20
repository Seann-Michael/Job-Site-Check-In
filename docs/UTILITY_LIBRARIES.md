# Utility Libraries Documentation

## 📚 Client-Side Utility Libraries (`client/lib/`)

### Authentication Library (`client/lib/auth.ts`)

**Purpose**: Client-side authentication state management and token handling.

**Key Functions**:

```typescript
class AuthClient {
  private supabase = createSupabaseClient();

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResponse> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new AuthError(error.message, error.status);
    }

    // Store session data
    await this.storeSession(data.session);

    return {
      user: data.user,
      session: data.session,
    };
  }

  // Handle 2FA verification
  async verify2FA(challengeId: string, code: string): Promise<AuthResponse> {
    const { data, error } = await this.supabase.auth.mfa.verify({
      factorId: challengeId,
      challengeId,
      code,
    });

    if (error) {
      throw new AuthError("Invalid 2FA code");
    }

    return data;
  }

  // Get current session
  async getSession(): Promise<Session | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  // Refresh access token
  async refreshToken(): Promise<AuthResponse> {
    const { data, error } = await this.supabase.auth.refreshSession();

    if (error) {
      throw new AuthError("Failed to refresh token");
    }

    return data;
  }

  // Sign out user
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    await this.clearSession();
  }

  // Listen to auth state changes
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) {
    return this.supabase.auth.onAuthStateChange(callback);
  }
}
```

**Token Management**:

```typescript
class TokenManager {
  private readonly TOKEN_KEY = "local_seo_ranker_token";
  private readonly REFRESH_KEY = "local_seo_ranker_refresh";

  // Store tokens securely
  async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    // Encrypt tokens before storing
    const encryptedAccess = await this.encrypt(accessToken);
    const encryptedRefresh = await this.encrypt(refreshToken);

    localStorage.setItem(this.TOKEN_KEY, encryptedAccess);
    localStorage.setItem(this.REFRESH_KEY, encryptedRefresh);
  }

  // Retrieve tokens
  async getTokens(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  }> {
    const encryptedAccess = localStorage.getItem(this.TOKEN_KEY);
    const encryptedRefresh = localStorage.getItem(this.REFRESH_KEY);

    if (!encryptedAccess || !encryptedRefresh) {
      return { accessToken: null, refreshToken: null };
    }

    return {
      accessToken: await this.decrypt(encryptedAccess),
      refreshToken: await this.decrypt(encryptedRefresh),
    };
  }

  // Clear tokens
  clearTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
  }
}
```

### Google Maps Integration (`client/lib/googleMaps.ts`)

**Purpose**: Client-side Google Maps API integration for location services.

**Core Implementation**:

```typescript
class GoogleMapsClient {
  private map: google.maps.Map | null = null;
  private geocoder: google.maps.Geocoder;
  private placesService: google.maps.places.PlacesService | null = null;

  constructor(private apiKey: string) {
    this.geocoder = new google.maps.Geocoder();
  }

  // Initialize map instance
  async initializeMap(
    element: HTMLElement,
    options: MapOptions,
  ): Promise<google.maps.Map> {
    await this.loadGoogleMapsAPI();

    const defaultOptions: google.maps.MapOptions = {
      zoom: 13,
      center: { lat: 37.7749, lng: -122.4194 }, // Default to San Francisco
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      ...options,
    };

    this.map = new google.maps.Map(element, defaultOptions);
    this.placesService = new google.maps.places.PlacesService(this.map);

    return this.map;
  }

  // Search for places near location
  async searchPlaces(request: PlaceSearchRequest): Promise<PlaceResult[]> {
    if (!this.placesService) {
      throw new Error("Places service not initialized");
    }

    return new Promise((resolve, reject) => {
      this.placesService!.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results.map(this.mapPlaceResult));
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }

  // Get detailed place information
  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    if (!this.placesService) {
      throw new Error("Places service not initialized");
    }

    return new Promise((resolve, reject) => {
      this.placesService!.getDetails(
        {
          placeId,
          fields: [
            "name",
            "formatted_address",
            "geometry",
            "photos",
            "reviews",
            "rating",
            "user_ratings_total",
            "opening_hours",
            "website",
            "formatted_phone_number",
          ],
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            resolve(this.mapPlaceDetails(place));
          } else {
            reject(new Error(`Place details failed: ${status}`));
          }
        },
      );
    });
  }

  // Geocode address to coordinates
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const result = results[0];
          resolve({
            address: result.formatted_address,
            location: {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
            },
            placeId: result.place_id,
            addressComponents: result.address_components,
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }

  // Reverse geocode coordinates to address
  async reverseGeocode(location: LatLng): Promise<GeocodeResult> {
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ location }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const result = results[0];
          resolve({
            address: result.formatted_address,
            location,
            placeId: result.place_id,
            addressComponents: result.address_components,
          });
        } else {
          reject(new Error(`Reverse geocoding failed: ${status}`));
        }
      });
    });
  }

  // Calculate distance between two points
  calculateDistance(origin: LatLng, destination: LatLng): number {
    const service = new google.maps.DistanceMatrixService();

    return new Promise((resolve, reject) => {
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.IMPERIAL,
        },
        (response, status) => {
          if (status === "OK" && response.rows[0].elements[0].status === "OK") {
            resolve(response.rows[0].elements[0].distance.value);
          } else {
            reject(new Error(`Distance calculation failed: ${status}`));
          }
        },
      );
    });
  }
}
```

### Analytics Library (`client/lib/analytics.ts`)

**Purpose**: Client-side event tracking and performance monitoring.

**Core Implementation**:

```typescript
class AnalyticsClient {
  private config: AnalyticsConfig;
  private queue: AnalyticsEvent[] = [];
  private isInitialized = false;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.initialize();
  }

  // Initialize analytics tracking
  private async initialize(): Promise<void> {
    // Set up error tracking
    window.addEventListener("error", this.handleError.bind(this));
    window.addEventListener(
      "unhandledrejection",
      this.handlePromiseRejection.bind(this),
    );

    // Track page views automatically
    this.trackPageView();

    // Set up performance monitoring
    this.setupPerformanceMonitoring();

    this.isInitialized = true;

    // Process queued events
    await this.processQueue();
  }

  // Track custom events
  track(event: string, properties: EventProperties = {}): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId(),
      },
    };

    if (this.isInitialized) {
      this.sendEvent(analyticsEvent);
    } else {
      this.queue.push(analyticsEvent);
    }
  }

  // Track page views
  trackPageView(page?: string): void {
    const pageInfo = {
      page: page || window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      timestamp: Date.now(),
    };

    this.track("page_view", pageInfo);
  }

  // Track user interactions
  trackClick(
    element: HTMLElement,
    additionalProperties: EventProperties = {},
  ): void {
    const clickProperties = {
      element_type: element.tagName.toLowerCase(),
      element_id: element.id,
      element_class: element.className,
      element_text: element.textContent?.slice(0, 100),
      ...additionalProperties,
    };

    this.track("click", clickProperties);
  }

  // Track form submissions
  trackFormSubmission(formId: string, formData: Record<string, any>): void {
    const submissionProperties = {
      form_id: formId,
      form_fields: Object.keys(formData),
      timestamp: Date.now(),
    };

    this.track("form_submission", submissionProperties);
  }

  // Track errors
  trackError(error: Error, context: ErrorContext = {}): void {
    const errorProperties = {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      context,
      timestamp: Date.now(),
    };

    this.track("error", errorProperties);
  }

  // Performance monitoring
  private setupPerformanceMonitoring(): void {
    // Track Core Web Vitals
    this.trackCoreWebVitals();

    // Track resource loading
    this.trackResourcePerformance();

    // Track user interactions
    this.trackInteractionPerformance();
  }

  // Core Web Vitals tracking
  private trackCoreWebVitals(): void {
    // Largest Contentful Paint (LCP)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.track("performance_lcp", {
        value: lastEntry.startTime,
        rating: this.getLCPRating(lastEntry.startTime),
      });
    }).observe({ entryTypes: ["largest-contentful-paint"] });

    // First Input Delay (FID)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        this.track("performance_fid", {
          value: entry.processingStart - entry.startTime,
          rating: this.getFIDRating(entry.processingStart - entry.startTime),
        });
      });
    }).observe({ entryTypes: ["first-input"] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      this.track("performance_cls", {
        value: clsValue,
        rating: this.getCLSRating(clsValue),
      });
    }).observe({ entryTypes: ["layout-shift"] });
  }
}
```

### Security Library (`client/lib/security.ts`)

**Purpose**: Client-side security utilities and input validation.

**Core Implementation**:

```typescript
class SecurityUtils {
  // Sanitize HTML input to prevent XSS
  static sanitizeHTML(input: string): string {
    const div = document.createElement("div");
    div.textContent = input;
    return div.innerHTML;
  }

  // Validate and sanitize user input
  static sanitizeInput(input: string, options: SanitizeOptions = {}): string {
    let sanitized = input.trim();

    // Remove potential XSS vectors
    sanitized = sanitized.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      "",
    );
    sanitized = sanitized.replace(/javascript:/gi, "");
    sanitized = sanitized.replace(/on\w+\s*=/gi, "");

    // Apply custom filters
    if (options.allowedTags) {
      const allowedPattern = new RegExp(
        `<(?!\/?(?:${options.allowedTags.join("|")})\s*\/?>)[^>]+>`,
        "gi",
      );
      sanitized = sanitized.replace(allowedPattern, "");
    } else {
      // Remove all HTML tags if none are allowed
      sanitized = sanitized.replace(/<[^>]*>/g, "");
    }

    // Limit length
    if (options.maxLength) {
      sanitized = sanitized.slice(0, options.maxLength);
    }

    return sanitized;
  }

  // Validate password strength
  static validatePasswordStrength(password: string): PasswordStrengthResult {
    const checks = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noCommonPatterns: !this.isCommonPassword(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    return {
      score,
      strength: this.getPasswordStrengthLabel(score),
      checks,
      feedback: this.getPasswordFeedback(checks),
    };
  }

  // Generate secure random string
  static generateSecureRandom(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  // Validate email format
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate phone number format
  static validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
  }

  // Check for potential XSS attempts
  static detectXSSAttempts(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /expression\s*\(/gi,
    ];

    return xssPatterns.some((pattern) => pattern.test(input));
  }

  // Encrypt sensitive data for local storage
  static async encryptForStorage(data: string, key?: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Use provided key or generate one
    const cryptoKey = key
      ? await this.deriveKey(key)
      : await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      dataBuffer,
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  // Decrypt data from local storage
  static async decryptFromStorage(
    encryptedData: string,
    key: string,
  ): Promise<string> {
    const combined = Uint8Array.from(atob(encryptedData), (c) =>
      c.charCodeAt(0),
    );
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const cryptoKey = await this.deriveKey(key);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encrypted,
    );

    return new TextDecoder().decode(decrypted);
  }

  // Derive encryption key from password
  private static async deriveKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("local-seo-ranker-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
}
```

### Error Handling Library (`client/lib/errorHandling.ts`)

**Purpose**: Comprehensive error handling and user feedback management.

**Core Implementation**:

```typescript
class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorQueue: ErrorReport[] = [];

  constructor(config: ErrorHandlerConfig) {
    this.config = config;
    this.setupGlobalErrorHandling();
  }

  // Set up global error handlers
  private setupGlobalErrorHandling(): void {
    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        type: 'javascript_error',
        source: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        type: 'unhandled_promise_rejection'
      });
    });
  }

  // Main error handling function
  handleError(error: Error | string, context: ErrorContext = {}): void {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      message: typeof error === 'string' ? error : error.message,
      stack: error instanceof Error ? error.stack : undefined,
      type: context.type || 'unknown',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.getCurrentUserId(),
      context
    };

    // Add to queue for batch processing
    this.errorQueue.push(errorReport);

    // Log to console in development
    if (this.config.isDevelopment) {
      console.error('Error caught:', errorReport);
    }

    // Show user notification if configured
    if (this.config.showUserNotifications) {
      this.showUserNotification(errorReport);
    }

    // Send to monitoring service
    if (this.config.enableRemoteLogging) {
      this.reportError(errorReport);
    }

    // Process queue if it's full
    if (this.errorQueue.length >= this.config.batchSize) {
      this.processBatch();
    }
  }

  // Handle API errors specifically
  handleAPIError(error: APIError): UserFriendlyError {
    const userError: UserFriendlyError = {
      title: 'Something went wrong',
      message: 'Please try again later',
      action: 'retry',
      originalError: error
    };

    switch (error.status) {
      case 400:
        userError.title = 'Invalid Request';
        userError.message = 'Please check your input and try again';
        break;
      case 401:
        userError.title = 'Authentication Required';
        userError.message = 'Please sign in to continue';
        userError.action = 'login';
        break;
      case 403:
        userError.title = 'Access Denied';
        userError.message = 'You don\'t have permission to perform this action';
        userError.action = 'none';
        break;
      case 404:
        userError.title = 'Not Found';
        userError.message = 'The requested resource could not be found';
        break;
      case 429:
        userError.title = 'Too Many Requests';
        userError.message = 'Please wait a moment before trying again';
        userError.action = 'wait';
        break;
      case 500:
        userError.title = 'Server Error';
        userError.message = 'Our servers are experiencing issues. Please try again later';
        break;
    }

    this.handleError(error, { type: 'api_error', status: error.status });
    return userError;
  }

  // Show user-friendly error notification
  private showUserNotification(errorReport: ErrorReport): void {
    const notification = {
      type: 'error' as const,
      title: this.getUserFriendlyTitle(errorReport),
      message: this.getUserFriendlyMessage(errorReport),
      duration: 5000,
      actions: this.getErrorActions(errorReport)
    };

    // Use toast notification system
    this.config.notificationService.show(notification);
  }

  // Retry failed operations
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const waitTime = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError!;
  }

  // Create error boundary for React components
  createErrorBoundary(): React.ComponentType<ErrorBoundaryProps> {
    return class ErrorBoundary extends React.Component<
      ErrorBoundaryProps,
      { hasError: boolean; error: Error | null }
    > {
      constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
      }

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.context.handleError(error, {
          type: 'react_error',
          componentStack: errorInfo.componentStack
        });
      }

      render() {
        if (this.state.hasError) {
          return this.props.fallback || <DefaultErrorFallback error={this.state.error} />;
        }

        return this.props.children;
      }
    };
  }
}
```

---

This utility libraries documentation provides comprehensive coverage of all major client-side utility functions in the Local SEO Ranker system, including authentication, Google Maps integration, analytics, file optimization, security, and error handling.

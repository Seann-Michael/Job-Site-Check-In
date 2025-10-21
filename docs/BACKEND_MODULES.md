# Backend Modules Documentation

## 🔧 Server Architecture & API Modules

### Netlify Functions (`netlify/functions/`)

#### Main API Handler (`netlify/functions/api.ts`)

**Purpose**: Centralized serverless API handler using Express.js framework.

**Architecture**:

```typescript
import express from "express";
import cors from "cors";
import serverless from "serverless-http";

const app = express();

// Middleware Configuration
app.use(
  cors({
    origin: ["https://app.mylocalseoranker.com", "http://localhost:8080"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
```

**Route Configuration**:

```typescript
// Authentication routes
app.use("/auth", authRoutes);

// Business management routes
app.use("/businesses", businessRoutes);

// Project management routes
app.use("/projects", projectRoutes);

// SEO analysis routes
app.use("/seo", seoRoutes);

// Review management routes
app.use("/reviews", reviewRoutes);

// Communication routes (SMS/Email)
app.use("/communications", communicationRoutes);

// Webhook management routes
app.use("/webhooks", webhookRoutes);

// Analytics and reporting routes
app.use("/analytics", analyticsRoutes);

// Integration routes
app.use("/integrations", integrationRoutes);
```

**Error Handling Middleware**:

```typescript
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error for monitoring
  console.error("API Error:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  });

  // Determine error type and status code
  let statusCode = 500;
  let errorCode = "INTERNAL_SERVER_ERROR";

  if (error.name === "ValidationError") {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
  } else if (error.name === "UnauthorizedError") {
    statusCode = 401;
    errorCode = "UNAUTHORIZED";
  } else if (error.name === "ForbiddenError") {
    statusCode = 403;
    errorCode = "FORBIDDEN";
  }

  // Return standardized error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: error.message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Authentication Module

#### Authentication Service (`server/services/AuthService.ts`)

**Purpose**: User authentication, session management, and security validation.

**Key Functions**:

```typescript
class AuthService {
  // User registration with email verification
  async registerUser(userData: RegisterUserData): Promise<AuthResult> {
    // Validate input data
    const validatedData = await this.validateRegistrationData(userData);

    // Check if user already exists
    const existingUser = await supabase
      .from("users")
      .select("id")
      .eq("email", validatedData.email)
      .single();

    if (existingUser.data) {
      throw new Error("User already exists");
    }

    // Create user in Supabase Auth
    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      email_confirm: false,
      user_metadata: {
        name: validatedData.name,
        role: validatedData.role || "business_owner",
      },
    });

    if (error) throw error;

    // Create user profile
    const { data: profile } = await supabase
      .from("users")
      .insert({
        id: authUser.user.id,
        email: validatedData.email,
        name: validatedData.name,
        role: validatedData.role || "business_owner",
      })
      .select()
      .single();

    // Send verification email
    await this.sendVerificationEmail(authUser.user.email);

    return {
      user: profile.data,
      requiresVerification: true,
    };
  }

  // User authentication with 2FA support
  async authenticateUser(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password, twoFactorCode } = credentials;

    // Primary authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      await this.logFailedAttempt(email, "invalid_credentials");
      throw new Error("Invalid credentials");
    }

    // Check if 2FA is enabled
    const user = await this.getUserProfile(data.user.id);

    if (user.is_2fa_enabled) {
      if (!twoFactorCode) {
        return {
          requiresTwoFactor: true,
          tempToken: await this.generateTempToken(user.id),
        };
      }

      // Verify 2FA code
      const isValid = await this.verify2FACode(user.id, twoFactorCode);
      if (!isValid) {
        throw new Error("Invalid 2FA code");
      }
    }

    // Update last login
    await this.updateLastLogin(user.id);

    // Generate session tokens
    const tokens = await this.generateTokens(user);

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  // Two-factor authentication setup
  async enable2FA(userId: string): Promise<TwoFactorSetup> {
    const secret = authenticator.generateSecret();
    const user = await this.getUserProfile(userId);

    const keyUri = authenticator.keyuri(user.email, "Local SEO Ranker", secret);

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(keyUri);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store encrypted secret and backup codes
    await supabase.from("user_2fa").upsert({
      user_id: userId,
      secret: await this.encryptData(secret),
      backup_codes: await Promise.all(
        backupCodes.map((code) => this.encryptData(code)),
      ),
      is_enabled: false, // Will be enabled after verification
    });

    return {
      secret,
      qrCodeUrl,
      backupCodes,
      keyUri,
    };
  }

  // Session validation and renewal
  async validateSession(token: string): Promise<SessionInfo> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;

      // Check if session is still active
      const session = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", decoded.userId)
        .eq("is_active", true)
        .single();

      if (!session.data) {
        throw new Error("Session not found");
      }

      // Update last activity
      await supabase
        .from("user_sessions")
        .update({ last_activity: new Date().toISOString() })
        .eq("id", session.data.id);

      return {
        userId: decoded.userId,
        sessionId: session.data.id,
        role: decoded.role,
        permissions: decoded.permissions,
      };
    } catch (error) {
      throw new Error("Invalid session");
    }
  }
}
```

### Business Management Module

#### Business Service (`server/services/BusinessService.ts`)

**Purpose**: Business profile management, validation, and integration with external services.

**Key Functions**:

```typescript
class BusinessService {
  // Create new business profile
  async createBusiness(
    businessData: CreateBusinessData,
    ownerId: string,
  ): Promise<Business> {
    // Validate business data
    const validatedData = await this.validateBusinessData(businessData);

    // Validate address using Google Maps API
    const addressValidation = await this.googleMapsService.validateAddress(
      validatedData.address,
    );

    if (!addressValidation.isValid) {
      throw new Error("Invalid business address");
    }

    // Check for duplicate businesses
    const existingBusiness = await this.checkDuplicateBusiness(
      validatedData.name,
      addressValidation.standardized,
    );

    if (existingBusiness) {
      throw new Error("Business already exists at this location");
    }

    // Create business record
    const { data: business, error } = await supabase
      .from("businesses")
      .insert({
        owner_id: ownerId,
        name: validatedData.name,
        description: validatedData.description,
        address: addressValidation.standardized,
        phone: validatedData.phone,
        email: validatedData.email,
        website: validatedData.website,
        category: validatedData.category,
        business_hours: validatedData.businessHours,
        social_media: validatedData.socialMedia,
      })
      .select()
      .single();

    if (error) throw error;

    // Initialize Google My Business integration if available
    if (validatedData.googleMyBusinessId) {
      await this.initializeGMBIntegration(
        business.id,
        validatedData.googleMyBusinessId,
      );
    }

    // Create default project for business
    await this.projectService.createDefaultProject(business.id);

    // Send welcome email
    await this.communicationService.sendWelcomeEmail(business);

    return business;
  }

  // Google My Business integration
  async syncWithGoogleMyBusiness(
    businessId: string,
    gmbLocationId: string,
  ): Promise<GMBSyncResult> {
    const business = await this.getBusinessById(businessId);

    // Fetch GMB data
    const gmbData = await this.googleMyBusinessAPI.getLocation(gmbLocationId);

    // Map GMB data to business fields
    const updatedData = {
      name: gmbData.locationName,
      address: this.mapGMBAddress(gmbData.address),
      phone: gmbData.primaryPhone,
      website: gmbData.websiteUri,
      business_hours: this.mapGMBHours(gmbData.regularHours),
      google_place_id: gmbData.metadata.placeId,
    };

    // Update business with GMB data
    const { data: updatedBusiness } = await supabase
      .from("businesses")
      .update(updatedData)
      .eq("id", businessId)
      .select()
      .single();

    // Sync reviews
    const reviews = await this.googleMyBusinessAPI.getReviews(gmbLocationId);
    await this.reviewService.syncGMBReviews(businessId, reviews);

    // Update sync status
    await supabase.from("gmb_integrations").upsert({
      business_id: businessId,
      gmb_location_id: gmbLocationId,
      last_sync: new Date().toISOString(),
      sync_status: "success",
    });

    return {
      business: updatedBusiness,
      reviewsCount: reviews.length,
      lastSync: new Date().toISOString(),
    };
  }

  // Business analytics and insights
  async getBusinessAnalytics(
    businessId: string,
    dateRange: DateRange,
  ): Promise<BusinessAnalytics> {
    const [reviewStats, rankingData, trafficData, conversionData] =
      await Promise.all([
        this.getReviewAnalytics(businessId, dateRange),
        this.getRankingAnalytics(businessId, dateRange),
        this.getTrafficAnalytics(businessId, dateRange),
        this.getConversionAnalytics(businessId, dateRange),
      ]);

    return {
      reviewStats,
      rankingData,
      trafficData,
      conversionData,
      period: dateRange,
      generatedAt: new Date().toISOString(),
    };
  }
}
```

### SEO Analysis Module

#### SEO Service (`server/services/SEOService.ts`)

**Purpose**: Keyword ranking tracking and optimization recommendations.

**Key Functions**:

```typescript
class SEOService {

  // Keyword ranking tracking
  async trackKeywordRankings(
    trackingData: KeywordTrackingData,
  ): Promise<RankingResults> {
    const { keywords, location, device, searchEngine } = trackingData;

    const rankings = await Promise.all(
      keywords.map(async (keyword) => {
        const ranking = await this.checkKeywordRanking({
          keyword,
          location,
          device,
          searchEngine,
        });

        return {
          keyword,
          position: ranking.position,
          url: ranking.url,
          change: await this.calculateRankingChange(keyword, ranking.position),
          searchVolume: await this.getSearchVolume(keyword, location),
          difficulty: await this.getKeywordDifficulty(keyword),
          trackedAt: new Date().toISOString(),
        };
      }),
    );

    // Store ranking data
    await this.storeRankingData(rankings);

    return {
      rankings,
      averagePosition: this.calculateAveragePosition(rankings),
      improvedKeywords: rankings.filter((r) => r.change > 0).length,
      declinedKeywords: rankings.filter((r) => r.change < 0).length,
      trackedAt: new Date().toISOString(),
    };
  }

  // Local SEO optimization
  async analyzeLocalSEO(
    businessId: string,
    location: Location,
  ): Promise<LocalSEOAnalysis> {
    const business = await this.businessService.getBusinessById(businessId);

    // Google My Business analysis
    const gmbAnalysis = await this.analyzeGoogleMyBusiness(business);

    // Citation analysis
    const citationAnalysis = await this.analyzeCitations(business);

    // Local ranking analysis
    const localRankings = await this.analyzeLocalRankings(business, location);

    // Review analysis
    const reviewAnalysis = await this.analyzeReviews(businessId);

    // NAP consistency analysis
    const napConsistency = await this.analyzeNAPConsistency(business);

    return {
      gmbAnalysis,
      citationAnalysis,
      localRankings,
      reviewAnalysis,
      napConsistency,
      overallScore: this.calculateLocalSEOScore({
        gmbAnalysis,
        citationAnalysis,
        localRankings,
        reviewAnalysis,
        napConsistency,
      }),
    };
  }
}
```

### Communication Module

#### Communication Service (`server/services/CommunicationService.ts`)

**Purpose**: SMS and email communication management using Twilio and SendGrid.

**Key Functions**:

```typescript
class CommunicationService {
  private twilioClient: Twilio;
  private sendGridClient: any;

  constructor() {
    this.twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );

    this.sendGridClient = require("@sendgrid/mail");
    this.sendGridClient.setApiKey(process.env.SENDGRID_API_KEY);
  }

  // SMS messaging via Twilio
  async sendSMS(smsData: SMSData): Promise<SMSResult> {
    try {
      const message = await this.twilioClient.messages.create({
        body: smsData.message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: smsData.to,
        statusCallback: `${process.env.VITE_API_URL}/webhooks/twilio/sms-status`,
      });

      // Store message record
      await this.storeCommunication({
        type: "sms",
        recipient: smsData.to,
        content: smsData.message,
        twilio_sid: message.sid,
        status: "sent",
        business_id: smsData.businessId,
        campaign_id: smsData.campaignId,
      });

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
      };
    } catch (error) {
      // Log error and store failed message
      await this.storeCommunication({
        type: "sms",
        recipient: smsData.to,
        content: smsData.message,
        status: "failed",
        error_message: error.message,
        business_id: smsData.businessId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Email messaging via SendGrid
  async sendEmail(emailData: EmailData): Promise<EmailResult> {
    try {
      const msg = {
        to: emailData.to,
        from: emailData.from || "noreply@mylocalseoranker.com",
        subject: emailData.subject,
        html: emailData.htmlContent,
        text: emailData.textContent,
        templateId: emailData.templateId,
        dynamicTemplateData: emailData.templateData,
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
      };

      const response = await this.sendGridClient.send(msg);

      // Store email record
      await this.storeCommunication({
        type: "email",
        recipient: emailData.to,
        subject: emailData.subject,
        content: emailData.htmlContent || emailData.textContent,
        sendgrid_id: response[0].headers["x-message-id"],
        status: "sent",
        business_id: emailData.businessId,
        campaign_id: emailData.campaignId,
      });

      return {
        success: true,
        messageId: response[0].headers["x-message-id"],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Review request campaigns
  async sendReviewRequest(
    requestData: ReviewRequestData,
  ): Promise<CommunicationResult> {
    const { business, customer, channel, templateId } = requestData;

    // Generate review link
    const reviewLink = this.generateReviewLink(business.id, customer.id);

    // Prepare message content
    const templateData = {
      business_name: business.name,
      customer_name: customer.name,
      review_link: reviewLink,
      business_logo: business.logoUrl,
    };

    let result: CommunicationResult;

    if (channel === "sms") {
      const message = await this.renderTemplate(templateId, templateData);
      result = await this.sendSMS({
        to: customer.phone,
        message,
        businessId: business.id,
      });
    } else if (channel === "email") {
      result = await this.sendEmail({
        to: customer.email,
        templateId,
        templateData,
        businessId: business.id,
      });
    }

    // Track campaign metrics
    await this.trackCampaignMetrics(business.id, channel, result.success);

    return result;
  }

  // Automated campaign management
  async createCampaign(campaignData: CampaignData): Promise<Campaign> {
    const campaign = await supabase
      .from("campaigns")
      .insert({
        business_id: campaignData.businessId,
        name: campaignData.name,
        type: campaignData.type,
        channel: campaignData.channel,
        template_id: campaignData.templateId,
        schedule: campaignData.schedule,
        target_audience: campaignData.targetAudience,
        status: "active",
      })
      .select()
      .single();

    // Schedule campaign execution
    if (campaignData.schedule.frequency !== "manual") {
      await this.scheduleCampaign(campaign.data);
    }

    return campaign.data;
  }
}
```

### Webhook Management Module

#### Webhook Service (`server/services/WebhookService.ts`)

**Purpose**: Bidirectional webhook system for real-time integrations.

**Key Functions**:

```typescript
class WebhookService {
  // Register new webhook endpoint
  async registerWebhook(webhookData: WebhookRegistration): Promise<Webhook> {
    // Validate webhook URL
    const isValid = await this.validateWebhookUrl(webhookData.url);
    if (!isValid) {
      throw new Error("Invalid webhook URL - endpoint not reachable");
    }

    // Generate webhook secret
    const secret = this.generateWebhookSecret();

    // Test webhook endpoint
    const testResult = await this.testWebhookEndpoint(webhookData.url, secret);
    if (!testResult.success) {
      throw new Error(`Webhook test failed: ${testResult.error}`);
    }

    // Store webhook configuration
    const { data: webhook } = await supabase
      .from("webhooks")
      .insert({
        business_id: webhookData.businessId,
        url: webhookData.url,
        events: webhookData.events,
        secret,
        is_active: true,
        retry_policy: webhookData.retryPolicy || this.getDefaultRetryPolicy(),
      })
      .select()
      .single();

    return webhook;
  }

  // Deliver webhook with retry logic
  async deliverWebhook(
    webhookId: string,
    event: WebhookEvent,
  ): Promise<WebhookDelivery> {
    const webhook = await this.getWebhook(webhookId);
    if (!webhook || !webhook.is_active) {
      throw new Error("Webhook not found or inactive");
    }

    const delivery: WebhookDelivery = {
      id: generateId(),
      webhook_id: webhookId,
      event: event.type,
      payload: event.data,
      attempt_count: 0,
      created_at: new Date().toISOString(),
    };

    await this.attemptDelivery(webhook, delivery);
    return delivery;
  }

  // Attempt webhook delivery with retry logic
  private async attemptDelivery(
    webhook: Webhook,
    delivery: WebhookDelivery,
  ): Promise<void> {
    const maxRetries = webhook.retry_policy.max_retries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        delivery.attempt_count = attempt + 1;

        // Generate signature
        const signature = this.generateSignature(
          webhook.secret,
          JSON.stringify(delivery.payload),
        );

        // Make HTTP request
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": delivery.event,
            "X-Webhook-Delivery": delivery.id,
            "User-Agent": "LocalSEORanker-Webhooks/1.0",
            ...webhook.headers,
          },
          body: JSON.stringify(delivery.payload),
          timeout: 30000,
        });

        delivery.response_status = response.status;
        delivery.response_body = await response.text();
        delivery.response_headers = Object.fromEntries(
          response.headers.entries(),
        );

        if (response.ok) {
          delivery.delivered_at = new Date().toISOString();
          delivery.next_retry_at = null;
          break;
        } else {
          throw new Error(`HTTP ${response.status}: ${delivery.response_body}`);
        }
      } catch (error) {
        lastError = error;
        delivery.response_body = error.message;

        // Calculate next retry time
        if (attempt < maxRetries) {
          const delay = this.calculateRetryDelay(attempt, webhook.retry_policy);
          delivery.next_retry_at = new Date(Date.now() + delay).toISOString();
        }
      }
    }

    // Store delivery record
    await this.storeDelivery(delivery);

    // If all retries failed, mark webhook as problematic
    if (lastError && delivery.attempt_count > maxRetries) {
      await this.handleFailedWebhook(webhook.id, lastError);
    }
  }

  // Generate secure webhook signature
  private generateSignature(secret: string, payload: string): string {
    const crypto = require("crypto");
    return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
  }

  // Verify incoming webhook signature
  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const expectedSignature = this.generateSignature(secret, payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }
}
```

### Analytics Module

#### Analytics Service (`server/services/AnalyticsService.ts`)

**Purpose**: Data collection, processing, and reporting for business insights.

**Key Functions**:

```typescript
class AnalyticsService {
  // Collect and process analytics data
  async collectAnalyticsData(dataPoint: AnalyticsDataPoint): Promise<void> {
    // Validate data point
    const validatedData = await this.validateAnalyticsData(dataPoint);

    // Enrich with additional metadata
    const enrichedData = {
      ...validatedData,
      timestamp: new Date().toISOString(),
      session_id: this.generateSessionId(),
      user_agent: dataPoint.userAgent,
      ip_address: this.hashIP(dataPoint.ipAddress),
      geo_location: await this.getGeoLocation(dataPoint.ipAddress),
    };

    // Store in time-series database
    await this.storeAnalyticsData(enrichedData);

    // Trigger real-time processing
    await this.processRealTimeAnalytics(enrichedData);
  }

  // Generate comprehensive business reports
  async generateBusinessReport(
    reportConfig: ReportConfig,
  ): Promise<BusinessReport> {
    const { businessId, reportType, dateRange, includeComparisons } =
      reportConfig;

    // Collect data from multiple sources
    const [
      trafficData,
      rankingData,
      reviewData,
      conversionData,
      competitorData,
    ] = await Promise.all([
      this.getTrafficAnalytics(businessId, dateRange),
      this.getRankingAnalytics(businessId, dateRange),
      this.getReviewAnalytics(businessId, dateRange),
      this.getConversionAnalytics(businessId, dateRange),
      includeComparisons
        ? this.getCompetitorAnalytics(businessId, dateRange)
        : null,
    ]);

    // Calculate key metrics
    const keyMetrics = this.calculateKeyMetrics({
      trafficData,
      rankingData,
      reviewData,
      conversionData,
    });

    // Generate insights and recommendations
    const insights = await this.generateInsights({
      trafficData,
      rankingData,
      reviewData,
      conversionData,
      competitorData,
    });

    // Create visualizations
    const charts = await this.generateCharts({
      trafficData,
      rankingData,
      reviewData,
      conversionData,
    });

    const report: BusinessReport = {
      id: generateId(),
      business_id: businessId,
      report_type: reportType,
      date_range: dateRange,
      key_metrics: keyMetrics,
      traffic_data: trafficData,
      ranking_data: rankingData,
      review_data: reviewData,
      conversion_data: conversionData,
      competitor_data: competitorData,
      insights,
      charts,
      generated_at: new Date().toISOString(),
    };

    // Store report
    await this.storeReport(report);

    return report;
  }

  // Real-time dashboard data
  async getDashboardData(businessId: string): Promise<DashboardData> {
    const timeRanges = {
      today: this.getDateRange("today"),
      week: this.getDateRange("week"),
      month: this.getDateRange("month"),
    };

    // Fetch real-time metrics
    const [liveMetrics, recentActivity, alerts, quickStats] = await Promise.all(
      [
        this.getLiveMetrics(businessId),
        this.getRecentActivity(businessId, timeRanges.today),
        this.getActiveAlerts(businessId),
        this.getQuickStats(businessId, timeRanges.week),
      ],
    );

    return {
      liveMetrics,
      recentActivity,
      alerts,
      quickStats,
      lastUpdated: new Date().toISOString(),
    };
  }
}
```

---

This backend modules documentation provides comprehensive coverage of all major server-side components in the Local SEO Ranker system, including their purposes, architectures, key functions, and integration patterns.

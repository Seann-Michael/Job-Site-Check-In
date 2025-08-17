import { getCurrentUser, getCurrentBusiness } from "@/lib/auth";

/**
 * Interface for secure media URL configuration
 */
export interface SecureMediaConfig {
  accountId: string;
  projectId?: string;
  mediaType: "project" | "gallery" | "profile" | "document";
  isPublic: boolean;
  expiresAt?: Date;
}

/**
 * Interface for media file with secure URLs
 */
export interface SecureMediaFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  secureUrl: string;
  publicUrl: string;
  thumbnailUrl?: string;
  metadata?: any;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Generates cryptographically secure random strings for media URLs
 */
export class SecureMediaUrlGenerator {
  private static readonly BASE_URL = "/api/media";
  private static readonly PUBLIC_BASE_URL = "/public/media";

  /**
   * Generate a secure random string for URLs
   */
  static generateSecureToken(length: number = 32): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  }

  /**
   * Generate a unique media ID that includes account and project info
   */
  static generateMediaId(config: SecureMediaConfig): string {
    const timestamp = Date.now();
    const randomToken = this.generateSecureToken(16);
    const projectPart = config.projectId ? `_p${config.projectId}` : "";

    return `acc${config.accountId}${projectPart}_${config.mediaType}_${timestamp}_${randomToken}`;
  }

  /**
   * Generate secure internal URL for authenticated access
   */
  static generateSecureUrl(mediaId: string, filename: string): string {
    return `${this.BASE_URL}/${mediaId}/${encodeURIComponent(filename)}`;
  }

  /**
   * Generate public URL with obfuscated but unique identifiers
   */
  static generatePublicUrl(
    config: SecureMediaConfig,
    filename: string,
  ): string {
    // Create a more obfuscated public identifier
    const accountHash = this.hashString(config.accountId);
    const projectHash = config.projectId
      ? this.hashString(config.projectId)
      : "";
    const randomId = this.generateSecureToken(24);
    const timestamp = Date.now().toString(36); // Base36 for shorter string

    // Format: /public/media/{hashedAccount}_{hashedProject}_{timestamp}_{random}/{filename}
    const publicId =
      `${accountHash}_${projectHash}_${timestamp}_${randomId}`.replace(
        /__/g,
        "_",
      );
    const cleanFilename = this.sanitizeFilename(filename);

    return `${this.PUBLIC_BASE_URL}/${publicId}/${cleanFilename}`;
  }

  /**
   * Generate thumbnail URL based on the main media URL
   */
  static generateThumbnailUrl(
    mediaUrl: string,
    size: "small" | "medium" | "large" = "medium",
  ): string {
    const sizeMap = {
      small: "150x150",
      medium: "300x300",
      large: "600x600",
    };

    if (mediaUrl.includes(this.PUBLIC_BASE_URL)) {
      return mediaUrl.replace(
        this.PUBLIC_BASE_URL,
        `${this.PUBLIC_BASE_URL}/thumbs/${sizeMap[size]}`,
      );
    } else {
      return mediaUrl.replace(
        this.BASE_URL,
        `${this.BASE_URL}/thumbs/${sizeMap[size]}`,
      );
    }
  }

  /**
   * Create a complete media file record with secure URLs
   */
  static createSecureMediaFile(
    file: File,
    config: SecureMediaConfig,
    metadata?: any,
  ): SecureMediaFile {
    const mediaId = this.generateMediaId(config);
    const secureUrl = this.generateSecureUrl(mediaId, file.name);
    const publicUrl = this.generatePublicUrl(config, file.name);
    const thumbnailUrl = this.generateThumbnailUrl(publicUrl, "medium");

    const currentUser = getCurrentUser();

    return {
      id: mediaId,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      secureUrl,
      publicUrl,
      thumbnailUrl,
      metadata,
      uploadedAt: new Date(),
      uploadedBy: currentUser?.name || "Unknown",
    };
  }

  /**
   * Generate URLs for different contexts (project vs gallery)
   */
  static generateContextualUrls(
    file: File,
    context: {
      type: "project" | "gallery";
      projectId?: string;
      isPublic?: boolean;
    },
    metadata?: any,
  ): SecureMediaFile {
    const currentBusiness = getCurrentBusiness();
    const accountId = currentBusiness?.id || "default";

    const config: SecureMediaConfig = {
      accountId,
      projectId: context.projectId,
      mediaType: context.type,
      isPublic: context.isPublic ?? true,
    };

    return this.createSecureMediaFile(file, config, metadata);
  }

  /**
   * Extract account and project info from a secure URL
   */
  static parseSecureUrl(url: string): {
    accountId?: string;
    projectId?: string;
    mediaType?: string;
    isValid: boolean;
  } {
    try {
      // Extract path from URL
      const urlPath = new URL(url, window.location.origin).pathname;

      if (urlPath.startsWith(this.BASE_URL)) {
        // Internal secure URL: /api/media/{mediaId}/{filename}
        const parts = urlPath.replace(this.BASE_URL + "/", "").split("/");
        const mediaId = parts[0];

        if (mediaId.startsWith("acc")) {
          const matches = mediaId.match(/^acc([^_]+)(?:_p([^_]+))?_([^_]+)_/);
          if (matches) {
            return {
              accountId: matches[1],
              projectId: matches[2] || undefined,
              mediaType: matches[3],
              isValid: true,
            };
          }
        }
      } else if (urlPath.startsWith(this.PUBLIC_BASE_URL)) {
        // Public URL - limited info due to hashing
        return {
          isValid: true,
        };
      }

      return { isValid: false };
    } catch {
      return { isValid: false };
    }
  }

  /**
   * Validate if a URL belongs to the current user/business
   */
  static validateUrlAccess(url: string): boolean {
    const parsed = this.parseSecureUrl(url);
    if (!parsed.isValid) return false;

    const currentBusiness = getCurrentBusiness();
    const currentAccountId = currentBusiness?.id || "default";

    // For internal URLs, check account ID
    if (parsed.accountId) {
      return parsed.accountId === currentAccountId;
    }

    // For public URLs, allow access (they're meant to be public)
    return true;
  }

  /**
   * Hash a string to create obfuscated identifiers
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Sanitize filename for URL safety
   */
  private static sanitizeFilename(filename: string): string {
    // Remove or replace unsafe characters
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  /**
   * Generate RSS/API friendly URLs with proper expiration
   */
  static generateRSSCompatibleUrl(
    mediaFile: SecureMediaFile,
    expiresInDays: number = 30,
  ): string {
    const expirationTimestamp =
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
    const signature = this.generateSecureToken(16);

    // Add expiration and signature to public URL
    const url = new URL(mediaFile.publicUrl, window.location.origin);
    url.searchParams.set("exp", expirationTimestamp.toString());
    url.searchParams.set("sig", signature);

    return url.toString();
  }

  /**
   * Batch generate URLs for multiple files
   */
  static batchGenerateUrls(
    files: File[],
    context: {
      type: "project" | "gallery";
      projectId?: string;
      isPublic?: boolean;
    },
  ): SecureMediaFile[] {
    return files.map((file) => this.generateContextualUrls(file, context));
  }
}

/**
 * Utility functions for media URL management
 */
export class MediaUrlUtils {
  /**
   * Get appropriate URL based on context (internal vs external use)
   */
  static getDisplayUrl(
    mediaFile: SecureMediaFile,
    context: "internal" | "public" | "rss" = "internal",
  ): string {
    switch (context) {
      case "public":
        return mediaFile.publicUrl;
      case "rss":
        return SecureMediaUrlGenerator.generateRSSCompatibleUrl(mediaFile);
      case "internal":
      default:
        return mediaFile.secureUrl;
    }
  }

  /**
   * Get thumbnail URL with fallback
   */
  static getThumbnailUrl(
    mediaFile: SecureMediaFile,
    size: "small" | "medium" | "large" = "medium",
  ): string {
    if (mediaFile.thumbnailUrl) {
      return SecureMediaUrlGenerator.generateThumbnailUrl(
        mediaFile.thumbnailUrl,
        size,
      );
    }
    return SecureMediaUrlGenerator.generateThumbnailUrl(
      mediaFile.publicUrl,
      size,
    );
  }

  /**
   * Check if URL is accessible to current user
   */
  static canAccessUrl(url: string): boolean {
    return SecureMediaUrlGenerator.validateUrlAccess(url);
  }

  /**
   * Generate download URL with proper headers
   */
  static generateDownloadUrl(mediaFile: SecureMediaFile): string {
    const url = new URL(mediaFile.secureUrl, window.location.origin);
    url.searchParams.set("download", "true");
    url.searchParams.set("filename", mediaFile.originalName);
    return url.toString();
  }
}

// Export types (classes already exported above)
// Commented out to avoid conflicts
// export type { SecureMediaConfig, SecureMediaFile };

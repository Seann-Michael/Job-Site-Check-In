export interface ProjectInfo {
  id: string;
  name: string;
  address: string;
  customerName: string;
  keywords: string[];
  businessName?: string;
  cityState?: string;
}

interface MediaMetadata {
  businessName: string;
  timestamp: string;
  cityState: string;
  keywords: string[];
  tags: string[];
  projectId: string;
  projectName: string;
  projectAddress: string;
  customerName: string;
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  geoLocation?: {
    lat: number;
    lng: number;
  };
}

interface EnhancedMediaFile {
  file: File;
  metadata: MediaMetadata;
  dataUrl: string;
  enhancedFileName: string;
}

export class MediaMetadataEnhancer {
  /**
   * Extract business information from localStorage or project data
   */
  static getBusinessInfo(): { businessName: string; cityState: string } {
    // Try to get from settings first
    const settings = JSON.parse(localStorage.getItem("userSettings") || "{}");
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");

    const businessName =
      settings.businessName ||
      profile.businessName ||
      profile.companyName ||
      "Default Business";

    const cityState =
      settings.businessCity && settings.businessState
        ? `${settings.businessCity}, ${settings.businessState}`
        : profile.businessLocation || "City, State";

    return { businessName, cityState };
  }

  /**
   * Extract city and state from project address
   */
  static extractCityStateFromAddress(address: string): string {
    if (!address) return "Unknown Location";

    // Common patterns for addresses
    const addressParts = address.split(",").map((part) => part.trim());

    if (addressParts.length >= 3) {
      // Format: "Street, City, State ZIP"
      const city = addressParts[addressParts.length - 2];
      const stateZip = addressParts[addressParts.length - 1];
      const state = stateZip.split(" ")[0];
      return `${city}, ${state}`;
    } else if (addressParts.length === 2) {
      // Format: "City, State"
      return addressParts.join(", ");
    }

    return address;
  }

  /**
   * Generate enhanced filename with metadata
   */
  static generateEnhancedFileName(
    originalFileName: string,
    metadata: MediaMetadata,
  ): string {
    const timestamp = new Date(metadata.timestamp).toISOString().split("T")[0];
    const businessName = metadata.businessName.replace(/[^a-zA-Z0-9]/g, "_");
    const projectName = metadata.projectName.replace(/[^a-zA-Z0-9]/g, "_");

    const extension = originalFileName.split(".").pop() || "jpg";
    const baseFileName = originalFileName.replace(/\.[^/.]+$/, "");

    return `${businessName}_${projectName}_${timestamp}_${baseFileName}.${extension}`;
  }

  /**
   * Create comprehensive metadata for uploaded media
   */
  static createMetadata(
    file: File,
    projectInfo: ProjectInfo,
    additionalTags: string[] = [],
  ): MediaMetadata {
    const businessInfo = this.getBusinessInfo();
    const timestamp = new Date().toISOString();
    // Use PROJECT location (city, state) extracted from project address
    const projectCityState = this.extractCityStateFromAddress(
      projectInfo.address,
    );

    // Combine project keywords with additional tags
    const allKeywords = [
      ...projectInfo.keywords,
      ...additionalTags,
      projectInfo.name.toLowerCase(),
      "construction",
      "project",
      "documentation",
    ].filter(
      (keyword, index, array) => keyword && array.indexOf(keyword) === index,
    );

    return {
      businessName: businessInfo.businessName,
      timestamp,
      cityState: projectCityState, // This is the PROJECT location (city, state)
      keywords: allKeywords,
      tags: additionalTags,
      projectId: projectInfo.id,
      projectName: projectInfo.name,
      projectAddress: projectInfo.address,
      customerName: projectInfo.customerName,
      uploadedBy: this.getCurrentUser(),
      uploadedAt: timestamp,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };
  }

  /**
   * Get current user information
   */
  static getCurrentUser(): string {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    return profile.name || (profile.firstName && profile.lastName)
      ? `${profile.firstName} ${profile.lastName}`
      : "Current User";
  }

  /**
   * Enhance file with metadata
   */
  static async enhanceMediaFile(
    file: File,
    projectInfo: ProjectInfo,
    additionalTags: string[] = [],
  ): Promise<EnhancedMediaFile> {
    const metadata = this.createMetadata(file, projectInfo, additionalTags);
    const enhancedFileName = this.generateEnhancedFileName(file.name, metadata);

    // Convert file to data URL for preview
    const dataUrl = await this.fileToDataUrl(file);

    return {
      file,
      metadata,
      dataUrl,
      enhancedFileName,
    };
  }

  /**
   * Convert file to data URL
   */
  static fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Extract EXIF data from image files (if available)
   */
  static async extractExifData(file: File): Promise<any> {
    // In a real implementation, you would use a library like 'exif-js' or 'piexifjs'
    // For now, we'll return a placeholder structure
    return new Promise((resolve) => {
      // Simulate EXIF extraction
      setTimeout(() => {
        resolve({
          DateTimeOriginal: new Date().toISOString(),
          GPS: null, // Would contain GPS coordinates if available
          Camera: "Unknown",
          Software: "Unknown",
        });
      }, 100);
    });
  }

  /**
   * Create metadata summary for display
   */
  static createMetadataSummary(metadata: MediaMetadata): string {
    const summary = [
      `Business: ${metadata.businessName}`,
      `Project: ${metadata.projectName}`,
      `Location: ${metadata.cityState}`,
      `Date: ${new Date(metadata.timestamp).toLocaleDateString()}`,
      `Keywords: ${metadata.keywords.slice(0, 3).join(", ")}${metadata.keywords.length > 3 ? "..." : ""}`,
    ];

    return summary.join(" | ");
  }

  /**
   * Generate downloadable metadata file
   */
  static generateMetadataFile(metadata: MediaMetadata): Blob {
    const metadataContent = {
      ...metadata,
      generatedAt: new Date().toISOString(),
      version: "1.0",
    };

    return new Blob([JSON.stringify(metadataContent, null, 2)], {
      type: "application/json",
    });
  }

  /**
   * Validate required project information
   */
  static validateProjectInfo(projectInfo: Partial<ProjectInfo>): string[] {
    const errors: string[] = [];

    if (!projectInfo.name) errors.push("Project name is required");
    if (!projectInfo.address) errors.push("Project address is required");
    if (!projectInfo.customerName) errors.push("Customer name is required");

    return errors;
  }
}

export type { MediaMetadata, EnhancedMediaFile, ProjectInfo };

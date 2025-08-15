import { toast } from "sonner";

// DataForSEO API Configuration
const DATAFORSEO_BASE_URL = "https://api.dataforseo.com/v3";

interface DataForSEOCredentials {
  username: string;
  password: string;
}

interface GeographicWaypoint {
  id: string;
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface SERPMapResult {
  rank_group: number;
  rank_absolute: number;
  position: string;
  xpath: string;
  domain: string;
  title: string;
  url: string;
  breadcrumb?: string;
  website?: string;
  description?: string;
  phone?: string;
  address?: string;
  rating?: {
    rating_type: string;
    value: number;
    votes_count: number;
    rating_max: number;
  };
  price_level?: string;
  reviews_count?: number;
  main_image?: string;
  total_photos?: number;
  snippet?: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
  cid?: string;
  feature_id?: string;
  place_topics?: string[];
  category?: string;
  additional_info?: {
    service_options?: string[];
    highlights?: string[];
    popular_times?: {
      day_of_week: number;
      time_values: number[];
    }[];
    time_spent?: {
      min_minutes: number;
      max_minutes: number;
    };
    reservation_links?: string[];
    order_links?: string[];
  };
  work_hours?: {
    timetable?: {
      [key: string]: {
        open?: {
          hour: number;
          minute: number;
        };
        close?: {
          hour: number;
          minute: number;
        };
      };
    };
    current_status?: string;
  };
}

interface RankingRequestParams {
  keyword: string;
  latitude: number;
  longitude: number;
  language_code?: string;
  location_code?: number;
  depth?: number;
  device?: "desktop" | "mobile";
  os?: "windows" | "macos" | "android" | "ios";
}

interface RankingResult {
  waypoint: GeographicWaypoint;
  businessRank: number | null;
  totalResults: number;
  competitors: Array<{
    rank: number;
    name: string;
    address?: string;
    rating?: number;
    reviewsCount?: number;
    placeId?: string;
    phone?: string;
    website?: string;
  }>;
  searchedKeyword: string;
  timestamp: Date;
  error?: string;
}

interface BusinessProfile {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  placeId?: string;
  keywords: string[];
}

class DataForSEOService {
  private credentials: DataForSEOCredentials | null = null;
  private baseUrl = DATAFORSEO_BASE_URL;

  constructor() {
    // Initialize with environment variables if available
    const envUsername = import.meta.env.VITE_DATAFORSEO_USERNAME;
    const envPassword = import.meta.env.VITE_DATAFORSEO_PASSWORD;

    if (envUsername && envPassword) {
      console.log("✅ DataForSEO: Using environment variables");
      this.credentials = {
        username: envUsername,
        password: envPassword
      };
    } else {
      this.loadCredentials();
    }
  }

  private loadCredentials() {
    // If credentials already loaded from environment variables, skip
    if (this.credentials) {
      return;
    }

    // Try to load from localStorage as fallback
    if (typeof window !== "undefined") {
      const username = localStorage.getItem("dataforseo_username");
      const password = localStorage.getItem("dataforseo_password");

      if (username && password) {
        this.credentials = { username, password };
      }
    }
  }

  setCredentials(username: string, password: string) {
    this.credentials = { username, password };
    if (typeof window !== "undefined") {
      localStorage.setItem("dataforseo_username", username);
      localStorage.setItem("dataforseo_password", password);
    }
  }

  hasCredentials(): boolean {
    return this.credentials !== null;
  }

  private getAuthHeader(): string {
    if (!this.credentials) {
      throw new Error("DataForSEO credentials not configured");
    }
    return btoa(`${this.credentials.username}:${this.credentials.password}`);
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    if (!this.credentials) {
      throw new Error(
        "DataForSEO credentials not configured. Please set up your API credentials in Settings.",
      );
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${this.getAuthHeader()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();

      if (result.status_code !== 20000) {
        throw new Error(
          `API error: ${result.status_message || "Unknown error"}`,
        );
      }

      return result;
    } catch (error) {
      console.error("DataForSEO API Error:", error);
      throw error;
    }
  }

  async checkLocalRankings(
    business: BusinessProfile,
    params: RankingRequestParams,
  ): Promise<RankingResult> {
    const waypoint: GeographicWaypoint = {
      id: `${params.latitude}-${params.longitude}`,
      lat: params.latitude,
      lng: params.longitude,
    };

    try {
      const requestData = [
        {
          keyword: params.keyword,
          location_coordinate: `${params.latitude},${params.longitude}`,
          language_code: params.language_code || "en",
          device: params.device || "desktop",
          os: params.os || "windows",
          depth: params.depth || 20,
          se_domain: "google.com",
          calculate_rectangles: true,
        },
      ];

      const response = await this.makeRequest(
        "/serp/google/maps/live",
        requestData,
      );

      if (!response.tasks || response.tasks.length === 0) {
        throw new Error("No results returned from API");
      }

      const task = response.tasks[0];
      if (task.status_code !== 20000) {
        throw new Error(`Task failed: ${task.status_message}`);
      }

      const results = task.result?.[0]?.items || [];

      // Find business rank
      let businessRank: number | null = null;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (this.isBusinessMatch(result, business)) {
          businessRank = result.rank_group || i + 1;
          break;
        }
      }

      // Extract competitors
      const competitors = results
        .slice(0, 10)
        .map((result: SERPMapResult, index: number) => ({
          rank: result.rank_group || index + 1,
          name: result.title || "Unknown Business",
          address: result.address,
          rating: result.additional_info?.rating,
          reviewsCount: result.additional_info?.reviews_count,
          placeId: result.place_id,
          phone: result.phone,
          website: result.url,
        }));

      return {
        waypoint,
        businessRank,
        totalResults: results.length,
        competitors,
        searchedKeyword: params.keyword,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error checking local rankings:", error);
      return {
        waypoint,
        businessRank: null,
        totalResults: 0,
        competitors: [],
        searchedKeyword: params.keyword,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private isBusinessMatch(
    result: SERPMapResult,
    business: BusinessProfile,
  ): boolean {
    // Match by business name (case insensitive, partial match)
    if (result.title && business.name) {
      const resultName = result.title.toLowerCase().trim();
      const businessName = business.name.toLowerCase().trim();

      if (
        resultName.includes(businessName) ||
        businessName.includes(resultName)
      ) {
        return true;
      }
    }

    // Match by phone number
    if (result.phone && business.phone) {
      const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
      if (normalizePhone(result.phone) === normalizePhone(business.phone)) {
        return true;
      }
    }

    // Match by Place ID
    if (result.place_id && business.placeId) {
      if (result.place_id === business.placeId) {
        return true;
      }
    }

    // Match by address (partial)
    if (result.address && business.address) {
      const resultAddress = result.address.toLowerCase();
      const businessAddress = business.address.toLowerCase();

      // Extract street number and name for comparison
      const extractStreetInfo = (addr: string) => {
        const match = addr.match(/(\d+)\s+([^,]+)/);
        return match ? `${match[1]} ${match[2]}`.trim() : addr;
      };

      const resultStreet = extractStreetInfo(resultAddress);
      const businessStreet = extractStreetInfo(businessAddress);

      if (
        resultStreet &&
        businessStreet &&
        (resultStreet.includes(businessStreet) ||
          businessStreet.includes(resultStreet))
      ) {
        return true;
      }
    }

    return false;
  }

  async batchCheckRankings(
    business: BusinessProfile,
    waypoints: GeographicWaypoint[],
    keyword: string,
    options?: {
      device?: "desktop" | "mobile";
      language?: string;
      depth?: number;
    },
  ): Promise<RankingResult[]> {
    const batchSize = 5; // Process in batches to avoid overwhelming the API
    const results: RankingResult[] = [];

    for (let i = 0; i < waypoints.length; i += batchSize) {
      const batch = waypoints.slice(i, i + batchSize);

      const batchPromises = batch.map((waypoint) =>
        this.checkLocalRankings(business, {
          keyword,
          latitude: waypoint.lat,
          longitude: waypoint.lng,
          device: options?.device || "desktop",
          language_code: options?.language || "en",
          depth: options?.depth || 20,
        }),
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, batchIndex) => {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            // Create error result for failed requests
            results.push({
              waypoint: batch[batchIndex],
              businessRank: null,
              totalResults: 0,
              competitors: [],
              searchedKeyword: keyword,
              timestamp: new Date(),
              error: result.reason?.message || "Request failed",
            });
          }
        });

        // Add delay between batches to respect API limits
        if (i + batchSize < waypoints.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error("Batch processing error:", error);
        toast.error("Error processing ranking checks");
      }
    }

    return results;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Use a simple endpoint to test credentials
      const response = await this.makeRequest(
        "/serp/google/maps/locations",
        [],
      );
      return response.status_code === 20000;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  generateWaypoints(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 10,
    gridSize: number = 5,
  ): GeographicWaypoint[] {
    const waypoints: GeographicWaypoint[] = [];

    // Convert radius from km to degrees (rough approximation)
    const latDegreePerKm = 1 / 111; // 1 degree latitude ≈ 111 km
    const lngDegreePerKm = 1 / (111 * Math.cos((centerLat * Math.PI) / 180)); // Adjust for longitude

    const latRadius = radiusKm * latDegreePerKm;
    const lngRadius = radiusKm * lngDegreePerKm;

    const step = 2 / (gridSize - 1); // Step size for grid

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const latOffset = (i * step - 1) * latRadius;
        const lngOffset = (j * step - 1) * lngRadius;

        const lat = centerLat + latOffset;
        const lng = centerLng + lngOffset;

        waypoints.push({
          id: `waypoint-${i}-${j}`,
          lat,
          lng,
          name: `Grid Point ${i + 1}-${j + 1}`,
        });
      }
    }

    return waypoints;
  }

  generateCircularWaypoints(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 10,
    numberOfPoints: number = 12,
  ): GeographicWaypoint[] {
    const waypoints: GeographicWaypoint[] = [];

    // Add center point
    waypoints.push({
      id: "center",
      lat: centerLat,
      lng: centerLng,
      name: "Center Point",
    });

    // Convert radius from km to degrees
    const latDegreePerKm = 1 / 111;
    const lngDegreePerKm = 1 / (111 * Math.cos((centerLat * Math.PI) / 180));

    const latRadius = radiusKm * latDegreePerKm;
    const lngRadius = radiusKm * lngDegreePerKm;

    // Generate points in a circle
    for (let i = 0; i < numberOfPoints; i++) {
      const angle = (2 * Math.PI * i) / numberOfPoints;
      const lat = centerLat + latRadius * Math.cos(angle);
      const lng = centerLng + lngRadius * Math.sin(angle);

      waypoints.push({
        id: `circle-${i}`,
        lat,
        lng,
        name: `Point ${i + 1}`,
      });
    }

    return waypoints;
  }
}

// Export singleton instance
export const dataForSEOService = new DataForSEOService();

// Export types
export type {
  GeographicWaypoint,
  RankingResult,
  BusinessProfile,
  RankingRequestParams,
  SERPMapResult,
};

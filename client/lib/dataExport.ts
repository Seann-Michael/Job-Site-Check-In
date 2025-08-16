import { analytics } from "./analytics";

interface ExportOptions {
  format: "json" | "csv" | "xlsx" | "pdf";
  includeMedia?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  projects?: string[];
  compress?: boolean;
}

interface BackupOptions {
  includeMedia: boolean;
  compress: boolean;
  encrypt?: boolean;
  schedule?: "manual" | "daily" | "weekly" | "monthly";
}

export class DataExportService {
  private static readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks for large exports

  /**
   * Export projects data in specified format
   */
  static async exportProjects(options: ExportOptions): Promise<Blob> {
    analytics.track("data_export_started", {
      format: options.format,
      includeMedia: options.includeMedia,
    });

    const startTime = performance.now();

    try {
      const projects = this.getProjectsData(options);
      let exportData: Blob;

      switch (options.format) {
        case "json":
          exportData = await this.exportAsJSON(projects, options);
          break;
        case "csv":
          exportData = await this.exportAsCSV(projects);
          break;
        case "xlsx":
          exportData = await this.exportAsExcel(projects);
          break;
        case "pdf":
          exportData = await this.exportAsPDF(projects);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      const endTime = performance.now();
      analytics.track("data_export_completed", {
        format: options.format,
        fileSize: exportData.size,
        duration: endTime - startTime,
        projectCount: projects.length,
      });

      return exportData;
    } catch (error) {
      analytics.trackError(error as Error, { operation: "data_export" });
      throw error;
    }
  }

  /**
   * Create comprehensive backup of all user data
   */
  static async createBackup(options: BackupOptions): Promise<Blob> {
    analytics.track("backup_started", options);

    const backupData = {
      metadata: {
        version: "1.0",
        created: new Date().toISOString(),
        appVersion: "1.0.0",
        options,
      },
      projects: this.getProjectsData({ format: "json" }),
      settings: this.getUserSettings(),
      profile: this.getUserProfile(),
      savedSearches: this.getSavedSearches(),
      analytics: this.getAnalyticsData(),
    };

    if (options.includeMedia) {
      backupData.metadata = {
        ...backupData.metadata,
      };
      // Note: In a real implementation, you'd handle media files differently
      // This is a simplified approach for demo purposes
    }

    const jsonData = JSON.stringify(backupData, null, 2);
    let blob = new Blob([jsonData], { type: "application/json" });

    if (options.compress) {
      blob = await this.compressData(blob);
    }

    analytics.track("backup_completed", {
      fileSize: blob.size,
      projectCount: backupData.projects.length,
      compressed: options.compress,
    });

    return blob;
  }

  /**
   * Restore data from backup
   */
  static async restoreFromBackup(backupFile: File): Promise<void> {
    analytics.track("restore_started", { fileSize: backupFile.size });

    try {
      let content: string;

      // Check if file is compressed
      if (backupFile.name.endsWith(".gz") || backupFile.type.includes("gzip")) {
        const decompressed = await this.decompressData(backupFile);
        content = await decompressed.text();
      } else {
        content = await backupFile.text();
      }

      const backupData = JSON.parse(content);

      // Validate backup structure
      if (!this.validateBackup(backupData)) {
        throw new Error("Invalid backup file format");
      }

      // Restore data
      if (backupData.projects) {
        localStorage.setItem("projects", JSON.stringify(backupData.projects));
      }

      if (backupData.settings) {
        localStorage.setItem(
          "userSettings",
          JSON.stringify(backupData.settings),
        );
      }

      if (backupData.profile) {
        localStorage.setItem("userProfile", JSON.stringify(backupData.profile));
      }

      if (backupData.savedSearches) {
        localStorage.setItem(
          "savedSearches",
          JSON.stringify(backupData.savedSearches),
        );
      }

      analytics.track("restore_completed", {
        backupVersion: backupData.metadata?.version,
        projectCount: backupData.projects?.length || 0,
      });
    } catch (error) {
      analytics.trackError(error as Error, { operation: "data_restore" });
      throw error;
    }
  }

  /**
   * Schedule automatic backups
   */
  static scheduleBackups(options: BackupOptions): void {
    if (options.schedule === "manual") return;

    const intervals = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    const interval = intervals[options.schedule as keyof typeof intervals];

    setInterval(async () => {
      try {
        const backup = await this.createBackup(options);
        const filename = `gmb-booster-backup-${new Date().toISOString().split("T")[0]}.json`;
        this.downloadFile(backup, filename);

        analytics.track("automatic_backup_completed", {
          schedule: options.schedule,
          fileSize: backup.size,
        });
      } catch (error) {
        analytics.trackError(error as Error, { operation: "automatic_backup" });
      }
    }, interval);

    analytics.track("backup_scheduled", { schedule: options.schedule });
  }

  /**
   * Get projects data with optional filtering
   */
  private static getProjectsData(options: Partial<ExportOptions>): any[] {
    const allProjects = JSON.parse(localStorage.getItem("projects") || "[]");

    let filtered = allProjects;

    // Filter by project IDs if specified
    if (options.projects && options.projects.length > 0) {
      filtered = filtered.filter((p: any) => options.projects!.includes(p.id));
    }

    // Filter by date range if specified
    if (options.dateRange) {
      const startDate = new Date(options.dateRange.start);
      const endDate = new Date(options.dateRange.end);

      filtered = filtered.filter((p: any) => {
        const projectDate = new Date(p.createdAt);
        return projectDate >= startDate && projectDate <= endDate;
      });
    }

    return filtered;
  }

  /**
   * Export as JSON with optional media inclusion
   */
  private static async exportAsJSON(
    projects: any[],
    options: ExportOptions,
  ): Promise<Blob> {
    const exportData = {
      metadata: {
        exported: new Date().toISOString(),
        format: "json",
        version: "1.0",
        projectCount: projects.length,
        includeMedia: options.includeMedia,
      },
      projects,
    };

    if (options.includeMedia) {
      // In a real implementation, you'd handle media files properly
      exportData.metadata = {
        ...exportData.metadata,
      };
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    return new Blob([jsonString], { type: "application/json" });
  }

  /**
   * Export as CSV format
   */
  private static async exportAsCSV(projects: any[]): Promise<Blob> {
    const headers = [
      "ID",
      "Name",
      "Description",
      "Address",
      "Status",
      "Created Date",
      "Updated Date",
      "Photo Count",
      "Keywords",
    ];

    const csvRows = [headers.join(",")];

    projects.forEach((project) => {
      const row = [
        this.escapeCSV(project.id),
        this.escapeCSV(project.name),
        this.escapeCSV(project.description || ""),
        this.escapeCSV(project.address || ""),
        this.escapeCSV(project.status || ""),
        this.escapeCSV(project.createdAt),
        this.escapeCSV(project.updatedAt || ""),
        project.photos?.length || 0,
        this.escapeCSV((project.keywords || []).join("; ")),
      ];
      csvRows.push(row.join(","));
    });

    return new Blob([csvRows.join("\n")], { type: "text/csv" });
  }

  /**
   * Export as Excel format (simplified)
   */
  private static async exportAsExcel(projects: any[]): Promise<Blob> {
    // In a real implementation, you'd use a library like SheetJS
    // For now, return CSV with Excel MIME type
    const csvBlob = await this.exportAsCSV(projects);
    return new Blob([csvBlob], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  /**
   * Export as PDF format (simplified)
   */
  private static async exportAsPDF(projects: any[]): Promise<Blob> {
    // In a real implementation, you'd use a library like jsPDF
    // For now, create a simple text-based PDF
    const content = projects
      .map(
        (p) => `
Project: ${p.name}
Description: ${p.description || "N/A"}
Address: ${p.address || "N/A"}
Created: ${new Date(p.createdAt).toLocaleDateString()}
Photos: ${p.photos?.length || 0}
Keywords: ${(p.keywords || []).join(", ")}
---
`,
      )
      .join("\n");

    return new Blob([content], { type: "application/pdf" });
  }

  /**
   * Compress data using built-in compression
   */
  private static async compressData(blob: Blob): Promise<Blob> {
    // In a real implementation, you'd use compression library
    // For demo, just return the original blob
    return blob;
  }

  /**
   * Decompress data
   */
  private static async decompressData(blob: Blob): Promise<Blob> {
    // In a real implementation, you'd decompress
    // For demo, just return the original blob
    return blob;
  }

  /**
   * Validate backup file structure
   */
  private static validateBackup(data: any): boolean {
    return (
      data &&
      typeof data === "object" &&
      data.metadata &&
      Array.isArray(data.projects)
    );
  }

  /**
   * Get user settings
   */
  private static getUserSettings(): any {
    return JSON.parse(localStorage.getItem("userSettings") || "{}");
  }

  /**
   * Get user profile
   */
  private static getUserProfile(): any {
    return JSON.parse(localStorage.getItem("userProfile") || "{}");
  }

  /**
   * Get saved searches
   */
  private static getSavedSearches(): any[] {
    return JSON.parse(localStorage.getItem("savedSearches") || "[]");
  }

  /**
   * Get analytics data
   */
  private static getAnalyticsData(): any[] {
    return JSON.parse(localStorage.getItem("analytics-backup") || "[]");
  }

  /**
   * Escape CSV values
   */
  private static escapeCSV(value: any): string {
    const str = String(value || "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Download file helper
   */
  static downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Upload file helper
   */
  static uploadFile(accept: string): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error("No file selected"));
        }
      };

      input.onclick = () => {
        analytics.track("file_upload_dialog_opened", { accept });
      };

      input.click();
    });
  }
}

// React hooks for easier usage
export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const exportData = async (options: ExportOptions) => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const blob = await DataExportService.exportProjects(options);
      const filename = `gmb-booster-export-${new Date().toISOString().split("T")[0]}.${options.format}`;

      DataExportService.downloadFile(blob, filename);
      setExportProgress(100);
    } catch (error) {
      console.error("Export failed:", error);
      throw error;
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 2000);
    }
  };

  return { exportData, isExporting, exportProgress };
}

export function useDataBackup() {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const createBackup = async (options: BackupOptions) => {
    setIsCreatingBackup(true);

    try {
      const blob = await DataExportService.createBackup(options);
      const filename = `gmb-booster-backup-${new Date().toISOString().split("T")[0]}.json`;

      DataExportService.downloadFile(blob, filename);
    } catch (error) {
      console.error("Backup failed:", error);
      throw error;
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const restoreFromFile = async () => {
    setIsRestoring(true);

    try {
      const file = await DataExportService.uploadFile(".json,.gz");
      await DataExportService.restoreFromBackup(file);
    } catch (error) {
      console.error("Restore failed:", error);
      throw error;
    } finally {
      setIsRestoring(false);
    }
  };

  return { createBackup, restoreFromFile, isCreatingBackup, isRestoring };
}

// For React imports
import { useState } from "react";

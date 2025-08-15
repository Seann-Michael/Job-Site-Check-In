import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  Upload,
  Database,
  Archive,
  Calendar,
  FileText,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { useDataExport, useDataBackup } from "@/lib/dataExport";
import { useAnalytics } from "@/lib/analytics";

interface DataManagementProps {
  projects?: any[];
}

export function DataManagement({ projects = [] }: DataManagementProps) {
  const [exportFormat, setExportFormat] = useState<
    "json" | "csv" | "xlsx" | "pdf"
  >("json");
  const [includeMedia, setIncludeMedia] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [backupOptions, setBackupOptions] = useState({
    includeMedia: true,
    compress: true,
    encrypt: false,
    schedule: "manual" as "manual" | "daily" | "weekly" | "monthly",
  });

  const { exportData, isExporting, exportProgress } = useDataExport();
  const { createBackup, restoreFromFile, isCreatingBackup, isRestoring } =
    useDataBackup();
  const { trackFeatureUsage } = useAnalytics();

  const handleExport = async () => {
    try {
      trackFeatureUsage("data_export", "export_data", {
        format: exportFormat,
        includeMedia,
        projectCount: selectedProjects.length || projects.length,
      });

      await exportData({
        format: exportFormat,
        includeMedia,
        projects: selectedProjects.length > 0 ? selectedProjects : undefined,
        dateRange: dateRange.start ? dateRange : undefined,
      });

      toast.success("Data exported successfully!");
    } catch (error) {
      toast.error("Export failed. Please try again.");
    }
  };

  const handleBackup = async () => {
    try {
      trackFeatureUsage("data_backup", "create_backup", backupOptions);

      await createBackup(backupOptions);
      toast.success("Backup created successfully!");
    } catch (error) {
      toast.error("Backup failed. Please try again.");
    }
  };

  const handleRestore = async () => {
    try {
      trackFeatureUsage("data_restore", "restore_data");

      if (
        !confirm(
          "This will overwrite your current data. Are you sure you want to continue?",
        )
      ) {
        return;
      }

      await restoreFromFile();
      toast.success("Data restored successfully! Please refresh the page.");
    } catch (error) {
      toast.error("Restore failed. Please check your backup file.");
    }
  };

  const handleProjectToggle = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const selectAllProjects = () => {
    setSelectedProjects(projects.map((p) => p.id));
  };

  const clearProjectSelection = () => {
    setSelectedProjects([]);
  };

  const getStorageUsage = () => {
    let totalSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    return totalSize;
  };

  const formatBytes = (bytes: number) => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const storageUsage = getStorageUsage();
  const estimatedLimit = 5 * 1024 * 1024; // 5MB
  const usagePercentage = (storageUsage / estimatedLimit) * 100;

  return (
    <div className="space-y-6">
      {/* Storage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Local Storage Usage</span>
              <span>
                {formatBytes(storageUsage)} / {formatBytes(estimatedLimit)}
              </span>
            </div>
            <Progress value={Math.min(usagePercentage, 100)} />
            {usagePercentage > 80 && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                Storage is approaching limit. Consider creating a backup and
                archiving old projects.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Projects:</span> {projects.length}
            </div>
            <div>
              <span className="font-medium">Total Photos:</span>{" "}
              {projects.reduce((sum, p) => sum + (p.photos?.length || 0), 0)}
            </div>
            <div>
              <span className="font-medium">Last Backup:</span>{" "}
              {localStorage.getItem("lastBackup") || "Never"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Export your project data in various formats for analysis or backup
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select
              value={exportFormat}
              onValueChange={(value: any) => setExportFormat(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON (Complete Data)</SelectItem>
                <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                <SelectItem value="pdf">PDF (Report)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="include-media"
                checked={includeMedia}
                onCheckedChange={setIncludeMedia}
              />
              <Label htmlFor="include-media">Include media files</Label>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range (Optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Project Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Select Projects</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllProjects}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearProjectSelection}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-3">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No projects available
                  </p>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={project.id}
                        checked={selectedProjects.includes(project.id)}
                        onCheckedChange={() => handleProjectToggle(project.id)}
                      />
                      <Label
                        htmlFor={project.id}
                        className="text-sm cursor-pointer"
                      >
                        {project.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>

              {selectedProjects.length > 0 && (
                <Badge variant="secondary">
                  {selectedProjects.length} project(s) selected
                </Badge>
              )}
            </div>
          </div>

          {/* Export Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Exporting data...</span>
              </div>
              <Progress value={exportProgress} />
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Exporting..." : "Export Data"}
          </Button>
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup & Restore
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Create complete backups of your data or restore from existing
            backups
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backup Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="backup-media"
                checked={backupOptions.includeMedia}
                onCheckedChange={(checked) =>
                  setBackupOptions((prev) => ({
                    ...prev,
                    includeMedia: checked,
                  }))
                }
              />
              <Label htmlFor="backup-media">Include media files</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="backup-compress"
                checked={backupOptions.compress}
                onCheckedChange={(checked) =>
                  setBackupOptions((prev) => ({ ...prev, compress: checked }))
                }
              />
              <Label htmlFor="backup-compress">Compress backup</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="backup-encrypt"
                checked={backupOptions.encrypt}
                onCheckedChange={(checked) =>
                  setBackupOptions((prev) => ({ ...prev, encrypt: checked }))
                }
              />
              <Label htmlFor="backup-encrypt">
                Encrypt backup{" "}
                <Badge variant="outline" className="ml-1">
                  Coming Soon
                </Badge>
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Backup Schedule</Label>
              <Select
                value={backupOptions.schedule}
                onValueChange={(value: any) =>
                  setBackupOptions((prev) => ({ ...prev, schedule: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Only</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleBackup}
              disabled={isCreatingBackup}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              {isCreatingBackup ? "Creating..." : "Create Backup"}
            </Button>

            <Button
              variant="outline"
              onClick={handleRestore}
              disabled={isRestoring}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {isRestoring ? "Restoring..." : "Restore from Backup"}
            </Button>
          </div>

          {/* Warning */}
          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-medium text-orange-900 dark:text-orange-100">
                  Important Backup Information
                </h4>
                <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                  <li>
                    • Backups include all projects, settings, and preferences
                  </li>
                  <li>• Media files increase backup size significantly</li>
                  <li>• Restoring will overwrite all current data</li>
                  <li>• Keep backups in a secure location</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

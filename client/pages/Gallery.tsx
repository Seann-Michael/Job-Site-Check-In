import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppLayout } from "@/components/AppLayout";
import { MediaViewer } from "@/components/MediaViewer";
import { SmartMediaUploader } from "@/components/SmartMediaUploader";
import { PhotoActionMenu } from "@/components/PhotoActionMenu";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { compatibleDataService as dataService } from "@/lib/compatibleDataService";
import {
  ArrowLeft,
  Images,
  User,
  Calendar,
  MapPin,
  Download,
  Star,
  ChevronDown,
  Filter,
  SlidersHorizontal,
  Info,
  Upload,
  Plus,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface PhotoWithMetadata {
  url: string;
  projectId: string;
  projectName: string;
  projectAddress: string;
  uploadedAt: string;
  uploadedBy: string;
  tags: string[];
  isPrimary?: boolean;
  type: "photo" | "video";
  size: "small" | "medium" | "large";
  metadata?: {
    originalFileName: string;
    fileSize: number;
    fileType: string;
    category: string;
    altText: string;
    fallbackUrls?: string[];
  };
}

interface FilterState {
  startDate: string;
  endDate: string;
  selectedProject: string;
  selectedUser: string;
  selectedTags: string[];
  tagFilterMode: "or" | "and";
  mediaType: "all" | "photos" | "videos";
  photoSize: "all" | "small" | "medium" | "large";
  thumbnailSize: "small" | "medium" | "large";
  sortOrder: "newest" | "oldest";
}

// Hover-to-play video thumbnail — only streams when hovered
function VideoThumbnail({ url, onClick }: { url: string; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className="relative h-full w-full bg-black cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <video
        ref={videoRef}
        src={url}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={() => {
          // Seek slightly past 0 to force browser to render first frame
          if (videoRef.current) videoRef.current.currentTime = 0.1;
        }}
        className={`h-full w-full object-cover transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-80"}`}
      />
      {/* Play icon shown when not hovered */}
      {!isHovered && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-10 w-10 rounded-full bg-black/60 flex items-center justify-center">
            <svg className="h-5 w-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Gallery() {
  const [photos, setPhotos] = useState<PhotoWithMetadata[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<PhotoWithMetadata[]>([]);
  const [displayedPhotos, setDisplayedPhotos] = useState<PhotoWithMetadata[]>(
    [],
  );
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoWithMetadata | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const PHOTOS_PER_PAGE = 20;

  // Available filter options
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [users, setUsers] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    startDate: "",
    endDate: "",
    selectedProject: "all",
    selectedUser: "all",
    selectedTags: [],
    tagFilterMode: "or",
    mediaType: "all",
    photoSize: "all",
    thumbnailSize: "small",
    sortOrder: "newest",
  });

  const loadGalleryData = useCallback(async () => {
    try {
      setLoading(true);
      const projectsData = await dataService.getProjects();
      const allPhotos: PhotoWithMetadata[] = [];
      const projectOptions: Array<{ id: string; name: string }> = [];
      const userSet = new Set<string>();
      const tagSet = new Set<string>();

      for (const project of projectsData as any[]) {
        projectOptions.push({ id: project.id, name: project.name });

        // Load media from the project_media Supabase table
        const mediaItems = await dataService.getProjectPhotos(project.id);

        for (const media of mediaItems as any[]) {
          const isVideo = media.media_type === "video";
          const tags: string[] = media.metadata?.tags || [];
          tags.forEach((tag: string) => tagSet.add(tag));

          const uploadedBy = media.uploaded_by || media.metadata?.uploadedBy || "User";
          userSet.add(uploadedBy);

          allPhotos.push({
            url: media.file_path,
            projectId: project.id,
            projectName: project.name,
            projectAddress: project.location || project.address || "",
            uploadedAt: media.created_at,
            uploadedBy,
            tags,
            isPrimary: media.is_featured || false,
            type: isVideo ? "video" : "photo",
            size: "medium",
            metadata: {
              originalFileName: media.original_name || media.filename,
              fileSize: media.file_size || 0,
              fileType: media.mime_type || "",
              category: media.category || "general",
              altText: media.metadata?.altText || media.description || "",
            },
          });
        }
      }

      setProjects(projectOptions);
      setUsers(Array.from(userSet));
      setAllTags(Array.from(tagSet));
      setPhotos(allPhotos);
    } catch (error) {
      console.error("Error loading gallery data:", error);
      toast.error("Failed to load gallery data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGalleryData();
  }, [loadGalleryData]);

  // Apply pagination whenever filteredPhotos change
  useEffect(() => {
    const startIndex = 0;
    const endIndex = currentPage * PHOTOS_PER_PAGE;
    setDisplayedPhotos(filteredPhotos.slice(startIndex, endIndex));
  }, [filteredPhotos, currentPage]);

  // Apply filters whenever photos or filters change
  useEffect(() => {
    let filtered = [...photos];
    setCurrentPage(1); // Reset to first page when filters change

    // Date filtering
    if (filters.startDate) {
      filtered = filtered.filter(
        (photo) => new Date(photo.uploadedAt) >= new Date(filters.startDate),
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(
        (photo) => new Date(photo.uploadedAt) <= new Date(filters.endDate),
      );
    }

    // Project filtering
    if (filters.selectedProject !== "all") {
      filtered = filtered.filter(
        (photo) => photo.projectId === filters.selectedProject,
      );
    }

    // User filtering
    if (filters.selectedUser !== "all") {
      filtered = filtered.filter(
        (photo) => photo.uploadedBy === filters.selectedUser,
      );
    }

    // Tag filtering
    if (filters.selectedTags.length > 0) {
      filtered = filtered.filter((photo) => {
        if (filters.tagFilterMode === "and") {
          return filters.selectedTags.every((tag) => photo.tags.includes(tag));
        } else {
          return filters.selectedTags.some((tag) => photo.tags.includes(tag));
        }
      });
    }

    // Media type filtering
    if (filters.mediaType === "photos") {
      filtered = filtered.filter((photo) => photo.type === "photo");
    } else if (filters.mediaType === "videos") {
      filtered = filtered.filter((photo) => photo.type === "video");
    }

    // Sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.uploadedAt).getTime();
      const dateB = new Date(b.uploadedAt).getTime();
      return filters.sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    setFilteredPhotos(filtered);
  }, [photos, filters]);

  const loadMorePhotos = () => {
    setLoading(true);
    setTimeout(() => {
      setCurrentPage((prev) => prev + 1);
      setLoading(false);
    }, 500); // Small delay to show loading state
  };

  const hasMorePhotos = displayedPhotos.length < filteredPhotos.length;

  const downloadPhoto = (
    photoUrl: string,
    projectName: string,
    index: number,
  ) => {
    const a = document.createElement("a");
    a.href = photoUrl;
    a.download = `${projectName}-photo-${index}.jpg`;
    a.click();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter((t) => t !== tag)
        : [...prev.selectedTags, tag],
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      selectedProject: "all",
      selectedUser: "all",
      selectedTags: [],
      tagFilterMode: "or",
      mediaType: "all",
      photoSize: "all",
      thumbnailSize: "small",
      sortOrder: "newest",
    });
  };

  const handleFilesReady = async (files: any[]) => {
    if (files.length === 0) {
      toast.error("No files to upload");
      return;
    }

    toast.info(
      `Uploading ${files.length} file${files.length !== 1 ? "s" : ""}...`,
    );

    try {
      // Get projects from Supabase to find one to attach files to
      const projectsData = await dataService.getProjects() as any[];

      let targetProject = projectsData.find(
        (p: any) => p.name === "Gallery Uploads",
      );

      if (!targetProject && projectsData.length > 0) {
        targetProject = projectsData[0];
      } else if (!targetProject) {
        toast.error("Please create a project first before uploading media.");
        return;
      }

      // Upload each file to Supabase storage and create a project_media record
      const uploadPromises = files.map((fileData: any) =>
        dataService.uploadProjectPhoto(targetProject.id, fileData.file, {
          category: fileData.category || "general",
          description: fileData.description || "",
          altText: fileData.altText || "",
          title: fileData.title || fileData.file.name,
          tags: fileData.tags
            ? fileData.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : [],
          uploadedBy: "Current User",
        })
      );

      await Promise.all(uploadPromises);

      toast.success(
        `Successfully uploaded ${files.length} file${files.length !== 1 ? "s" : ""} to gallery!`,
      );

      setShowUploader(false);

      // Refresh gallery data without a full page reload
      await loadGalleryData();
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files. Please try again.");
    }
  };

  const handlePhotoEdit = (photo: PhotoWithMetadata) => {
    toast.info("Edit functionality coming soon!");
  };

  const handlePhotoDelete = async (photo: PhotoWithMetadata) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;
    try {
      // Find the media record id from the url by reloading the project media
      const mediaItems = await dataService.getProjectPhotos(photo.projectId) as any[];
      const mediaRecord = mediaItems.find((m: any) => m.file_path === photo.url);
      if (mediaRecord) {
        await dataService.deleteProjectPhoto(mediaRecord.id);
        toast.success("Photo deleted successfully");
        // Remove from local state without a full reload
        setPhotos((prev) => prev.filter((p) => p.url !== photo.url));
      } else {
        toast.error("Could not find media record to delete");
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Failed to delete photo");
    }
  };

  const handlePhotoToggleFavorite = (photo: PhotoWithMetadata) => {
    try {
      const newIsPrimary = !photo.isPrimary;
      // Update local state immediately for responsiveness
      setPhotos((prev) =>
        prev.map((p) =>
          p.url === photo.url ? { ...p, isPrimary: newIsPrimary } : p,
        ),
      );
      toast.success(newIsPrimary ? "Added to favorites" : "Removed from favorites");
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorite status");
    }
  };

  const handlePhotoDownload = (photo: PhotoWithMetadata) => {
    downloadPhoto(photo.url, photo.projectName, 0);
  };

  const handlePhotoViewDetails = (photo: PhotoWithMetadata) => {
    setSelectedPhoto(photo);
  };

  return (
    <AppLayout>
      <div className="w-full px-3 sm:px-4 py-6 max-w-full overflow-x-hidden min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Gallery</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Showing {displayedPhotos.length} of {filteredPhotos.length} items
              {filteredPhotos.length !== photos.length &&
                ` (filtered from ${photos.length})`}
            </p>
          </div>

          {/* Sort and Thumbnail Size Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto min-w-0">
            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
              <Label className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                Sort:
              </Label>
              <Select
                value={filters.sortOrder}
                onValueChange={(value: "newest" | "oldest") =>
                  updateFilter("sortOrder", value)
                }
              >
                <SelectTrigger className="w-full sm:w-40 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
              <Label className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                Size:
              </Label>
              <Select
                value={filters.thumbnailSize}
                onValueChange={(value: "small" | "medium" | "large") =>
                  updateFilter("thumbnailSize", value)
                }
              >
                <SelectTrigger className="w-full sm:w-32 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setShowUploader(true)}
              className="gap-2 w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload Files</span>
              <span className="sm:hidden">Upload</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2 w-full sm:w-auto"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">
                {showFilters ? "Hide Filters" : "Show Filters"}
              </span>
              <span className="sm:hidden">Filters</span>
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <Card className="p-4 sm:p-6 mb-6">
            <div className="space-y-4 sm:space-y-6">
              {/* Top Row - Date and Basic Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => updateFilter("startDate", e.target.value)}
                    className="w-auto"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => updateFilter("endDate", e.target.value)}
                    className="w-auto"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Jobs</Label>
                  <Select
                    value={filters.selectedProject}
                    onValueChange={(value) =>
                      updateFilter("selectedProject", value)
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Users</Label>
                  <Select
                    value={filters.selectedUser}
                    onValueChange={(value) =>
                      updateFilter("selectedUser", value)
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user} value={user}>
                          {user}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="w-48">
                    <div className="border rounded-md p-2 min-h-[40px] max-h-[120px] overflow-y-auto">
                      {filters.selectedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {filters.selectedTags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="default"
                              className="text-xs cursor-pointer"
                              onClick={() => toggleTag(tag)}
                            >
                              {tag} ×
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1">
                        {allTags
                          .filter((tag) => !filters.selectedTags.includes(tag))
                          .map((tag) => (
                            <div
                              key={tag}
                              className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer"
                              onClick={() => toggleTag(tag)}
                            >
                              <Checkbox
                                id={tag}
                                checked={filters.selectedTags.includes(tag)}
                                onCheckedChange={() => toggleTag(tag)}
                              />
                              <Label
                                htmlFor={tag}
                                className="text-sm cursor-pointer"
                              >
                                {tag}
                              </Label>
                            </div>
                          ))}
                        {allTags.length === 0 && (
                          <div className="text-sm text-muted-foreground p-1">
                            No tags available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>View</Label>
                  <Select value="grid">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="list">List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filter Options Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                {/* Tag Filter Mode */}
                {filters.selectedTags.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Filter Tags By
                    </Label>
                    <RadioGroup
                      value={filters.tagFilterMode}
                      onValueChange={(value: "or" | "and") =>
                        updateFilter("tagFilterMode", value)
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="or" id="or" />
                        <Label htmlFor="or" className="text-sm">
                          Or
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="and" id="and" />
                        <Label htmlFor="and" className="text-sm">
                          And
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Media Type */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Type</Label>
                  <RadioGroup
                    value={filters.mediaType}
                    onValueChange={(value: "all" | "photos" | "videos") =>
                      updateFilter("mediaType", value)
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="text-sm">
                        All
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="photos" id="photos" />
                      <Label htmlFor="photos" className="text-sm">
                        Photos Only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="videos" id="videos" />
                      <Label htmlFor="videos" className="text-sm">
                        Videos Only
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Clear Filters */}
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={clearFilters}>
                  Clear All Filters
                </Button>
              </div>
            </div>
          </Card>
        )}

        {displayedPhotos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Images className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                {photos.length === 0
                  ? "No photos yet"
                  : "No photos match your filters"}
              </h3>
              <p className="text-muted-foreground mb-6">
                {photos.length === 0
                  ? "Start adding photos to your jobs to see them here"
                  : "Try adjusting your filters to see more results"}
              </p>
              {photos.length === 0 ? (
                <Link to="/admin/add-job">
                  <Button>Create First Job</Button>
                </Link>
              ) : (
                <Button onClick={clearFilters}>Clear Filters</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Timeline View - Only View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline View
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(
                  displayedPhotos.reduce(
                    (groups, photo) => {
                      const date = new Date(
                        photo.uploadedAt,
                      ).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                      if (!groups[date]) groups[date] = [];
                      groups[date].push(photo);
                      return groups;
                    },
                    {} as Record<string, PhotoWithMetadata[]>,
                  ),
                ).map(([date, datePhotos]) => (
                  <div key={date} className="space-y-4 mb-8">
                    <div className="flex items-center gap-2">
                      <Checkbox className="rounded" />
                      <h2 className="text-lg font-semibold">{date}</h2>
                      <Badge variant="outline">{datePhotos.length} items</Badge>
                    </div>

                    <div
                      className={`grid gap-3 sm:gap-4 lg:gap-6 ${
                        filters.thumbnailSize === "small"
                          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
                          : filters.thumbnailSize === "large"
                            ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
                            : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                      }`}
                    >
                      {datePhotos.map((photo, index) => (
                        <Card
                          key={`${date}-${index}`}
                          className="overflow-hidden"
                        >
                          <div
                            className={`relative cursor-pointer group ${
                              filters.thumbnailSize === "small"
                                ? "aspect-square"
                                : filters.thumbnailSize === "large"
                                  ? "aspect-[4/3]"
                                  : "aspect-square"
                            }`}
                            onClick={() => setSelectedPhoto(photo)}
                          >
                            {photo.type === "video" ? (
                              <VideoThumbnail url={photo.url} onClick={() => setSelectedPhoto(photo)} />
                            ) : (
                              <ImageWithFallback
                                photo={photo}
                                alt={`${photo.type} from ${photo.projectName}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />

                            {/* Top badges */}
                            <div className="absolute top-2 left-2 flex gap-1 pointer-events-none">
                              {photo.isPrimary && (
                                <Badge variant="secondary" className="gap-1">
                                  <Star className="h-3 w-3" />
                                  Primary
                                </Badge>
                              )}
                              {photo.type === "video" && (
                                <Badge variant="default" className="gap-1">
                                  Video
                                </Badge>
                              )}
                            </div>

                            {/* Bottom badges */}
                            <div className="absolute bottom-2 left-2">
                              <Badge
                                variant="outline"
                                className="text-xs bg-black/50 text-white border-white/20"
                              >
                                {photo.size}
                              </Badge>
                            </div>

                            <div className="absolute top-2 right-2 opacity-90 group-hover:opacity-100 transition-opacity">
                              <PhotoActionMenu
                                photo={photo}
                                index={index}
                                projectName={photo.projectName}
                                onEdit={handlePhotoEdit}
                                onDelete={handlePhotoDelete}
                                onToggleFavorite={handlePhotoToggleFavorite}
                                onDownload={handlePhotoDownload}
                                onViewDetails={handlePhotoViewDetails}
                                isFavorite={photo.isPrimary}
                                className="h-6 w-6"
                              />
                            </div>
                          </div>
                          <CardContent
                            className={`${
                              filters.thumbnailSize === "small"
                                ? "p-2 sm:p-2"
                                : filters.thumbnailSize === "large"
                                  ? "p-3 sm:p-4 lg:p-6"
                                  : "p-2 sm:p-3 lg:p-4"
                            }`}
                          >
                            <Link
                              to={`/job/${photo.projectId}`}
                              className="block hover:text-primary transition-colors"
                            >
                              <h3
                                className={`font-semibold mb-1 line-clamp-1 ${
                                  filters.thumbnailSize === "small"
                                    ? "text-xs"
                                    : filters.thumbnailSize === "large"
                                      ? "text-base"
                                      : "text-sm"
                                }`}
                              >
                                {photo.projectName}
                              </h3>
                            </Link>

                            <div
                              className={`text-muted-foreground ${
                                filters.thumbnailSize === "small"
                                  ? "space-y-1 text-xs"
                                  : filters.thumbnailSize === "large"
                                    ? "space-y-3 text-sm"
                                    : "space-y-2 text-xs"
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="line-clamp-1">
                                  {photo.projectAddress}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{photo.uploadedBy}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(photo.uploadedAt)}</span>
                              </div>
                            </div>

                            {photo.tags.length > 0 && (
                              <div
                                className={`flex flex-wrap gap-1 ${
                                  filters.thumbnailSize === "small"
                                    ? "mt-1"
                                    : "mt-2"
                                }`}
                              >
                                {photo.tags
                                  .slice(
                                    0,
                                    filters.thumbnailSize === "small" ? 1 : 2,
                                  )
                                  .map((tag, tagIndex) => (
                                    <Badge
                                      key={tagIndex}
                                      variant="outline"
                                      className={
                                        filters.thumbnailSize === "small"
                                          ? "text-xs"
                                          : "text-xs"
                                      }
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                {photo.tags.length >
                                  (filters.thumbnailSize === "small"
                                    ? 1
                                    : 2) && (
                                  <Badge variant="outline" className="text-xs">
                                    +
                                    {photo.tags.length -
                                      (filters.thumbnailSize === "small"
                                        ? 1
                                        : 2)}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Load More Button */}
            {hasMorePhotos && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={loadMorePhotos}
                  disabled={loading}
                  variant="outline"
                  size="lg"
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Load More Photos (
                      {filteredPhotos.length - displayedPhotos.length}{" "}
                      remaining)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative flex flex-col md:flex-row w-full max-w-5xl max-h-[90vh] bg-card rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Image / Video */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-[240px] md:min-h-0">
              {selectedPhoto.type === "video" ? (
                <video
                  src={selectedPhoto.url}
                  controls
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: "80vh" }}
                />
              ) : (
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.metadata?.originalFileName || "Photo"}
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: "80vh" }}
                />
              )}
            </div>

            {/* Details panel */}
            <div className="w-full md:w-72 shrink-0 flex flex-col overflow-y-auto bg-card border-t md:border-t-0 md:border-l max-h-[40vh] md:max-h-[90vh]">
              <div className="p-4 border-b">
                <p className="font-semibold text-sm truncate">
                  {selectedPhoto.metadata?.originalFileName || "Photo"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {selectedPhoto.type === "video" ? "Video" : "Photo"}
                  {selectedPhoto.isPrimary && " · Primary"}
                </p>
              </div>

              <div className="p-4 space-y-4 text-sm">
                {/* Uploaded by */}
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Uploaded by</p>
                    <p className="font-medium">{selectedPhoto.uploadedBy || "Unknown"}</p>
                  </div>
                </div>

                {/* Date & time */}
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Uploaded on</p>
                    <p className="font-medium">
                      {selectedPhoto.uploadedAt
                        ? new Date(selectedPhoto.uploadedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPhoto.uploadedAt
                        ? new Date(selectedPhoto.uploadedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </p>
                  </div>
                </div>

                {/* Project */}
                {selectedPhoto.projectName && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Project</p>
                      <Link
                        to={`/job/${selectedPhoto.projectId}`}
                        className="font-medium text-primary hover:underline"
                        onClick={() => setSelectedPhoto(null)}
                      >
                        {selectedPhoto.projectName}
                      </Link>
                      {selectedPhoto.projectAddress && (
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedPhoto.projectAddress}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Category */}
                {selectedPhoto.metadata?.category && (
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="font-medium capitalize">{selectedPhoto.metadata.category}</p>
                    </div>
                  </div>
                )}

                {/* File size */}
                {selectedPhoto.metadata?.fileSize ? (
                  <div className="flex items-start gap-2">
                    <Images className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">File size</p>
                      <p className="font-medium">
                        {selectedPhoto.metadata.fileSize > 1024 * 1024
                          ? `${(selectedPhoto.metadata.fileSize / 1024 / 1024).toFixed(1)} MB`
                          : `${(selectedPhoto.metadata.fileSize / 1024).toFixed(0)} KB`}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Tags */}
                {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPhoto.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-auto p-4 border-t flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = selectedPhoto.url;
                    a.download = selectedPhoto.metadata?.originalFileName || "photo";
                    a.target = "_blank";
                    a.click();
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                {selectedPhoto.projectId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    asChild
                  >
                    <Link to={`/job/${selectedPhoto.projectId}`} onClick={() => setSelectedPhoto(null)}>
                      View Job
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={showUploader} onOpenChange={setShowUploader}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[85vh] md:max-h-[90vh] overflow-y-auto mobile-safe">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Files to Gallery
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUploader(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-900">
                    Gallery Upload
                  </p>
                  <p className="text-sm text-blue-700">
                    Files uploaded here will be added to a "Gallery Uploads"
                    project or attached to your first available project. You can
                    move them to specific projects later.
                  </p>
                </div>
              </div>
            </div>

            <SmartMediaUploader
              onFilesReady={handleFilesReady}
              acceptedTypes={["image/*", "video/*"]}
              maxFiles={50}
              maxFileSize={200}
              projectInfo={{
                name: "Gallery Uploads",
                keywords: ["gallery", "upload"],
              }}
              enableAIFeatures={true}
              autoApplyDefaults={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

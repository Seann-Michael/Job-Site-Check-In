// @ts-nocheck - Temporary suppression of type errors
import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AppLayout } from "@/components/AppLayout";
import { SafeGoogleMapComponent } from "@/components/GoogleMaps/SafeGoogleMapComponent";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { StreetView } from "@/components/StreetView";
import { PhotoActionMenu } from "@/components/PhotoActionMenu";
import {
  ArrowLeft,
  Edit,
  Share,
  Trash2,
  MapPin,
  CalendarDays,
  Tag,
  Download,
  ExternalLink,
  Images,
  MoreVertical,
  Plus,
  Phone,
  Star,
  CheckCircle,
  Clock,
  User,
  MessageSquare,
  Video,
  HardDrive,
  FileText,
  Calendar,
  UserPlus,
  AtSign,
  Smartphone,
  Monitor,
  Mail,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Link, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { compatibleDataService as dataService } from "@/lib/compatibleDataService";
import { ReviewRequest } from "@/components/ReviewRequest";
import { SmartMediaUploader } from "@/components/SmartMediaUploader";

interface TaggedPhoto {
  url: string;
  tags: string[];
  uploadedAt: string;
  uploadedBy: string;
  isPrimary?: boolean;
  _dbId?: string;
  media_type?: "image" | "video" | "document";
  mime_type?: string;
  file_size?: number;
}

interface ProjectDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: string;
  dueTime?: string;
  createdAt: string;
  completedAt?: string;
  completedBy?: string;
}

interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  completedBy?: string;
}

interface ProjectNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

interface ActivityLogEntry {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userId: string;
  userName: string;
  platform: "mobile" | "web";
  details?: any;
}

interface Project {
  id: string;
  name: string;
  description: string;
  address: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gpsLat?: string;
  gpsLng?: string;
  streetViewUrl?: string; // Store Street View URL to avoid repeated API calls
  hasStreetView?: boolean; // Track if Street View is available
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  mobilePhone?: string;
  additionalPhones?: string[];
  keywords: string[];
  metadata?: any;
  photos: TaggedPhoto[] | string[];
  videos?: TaggedPhoto[];
  documents: ProjectDocument[];
  tasks: Task[];
  checklist: ChecklistItem[];
  notes: ProjectNote[];
  activityLog: ActivityLogEntry[];
  primaryPhotoId?: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
  completedDate?: string;
  startDate?: string;
  completionDate?: string;
}

// Mock users for assignment
const mockUsers = [
  { id: "1", name: "John Smith", email: "john@company.com" },
  { id: "2", name: "Sarah Johnson", email: "sarah@company.com" },
  { id: "3", name: "Mike Wilson", email: "mike@company.com" },
  { id: "4", name: "Lisa Davis", email: "lisa@company.com" },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingChecklistItem, setEditingChecklistItem] = useState<
    string | null
  >(null);
  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState({
    title: "",
    assignedTo: "",
    dueDate: "",
    dueTime: "",
  });
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [showAddKeyword, setShowAddKeyword] = useState(false);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameDocValue, setRenameDocValue] = useState("");
  // Inline field editing
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [editAddressValue, setEditAddressValue] = useState("");
  const [editingContact, setEditingContact] = useState(false);
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [showDocumentUploader, setShowDocumentUploader] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProject = async () => {
      setIsLoadingProject(true);
      try {
        const projects = await dataService.getProjects();
        const foundProject = projects.find((p: any) => p.id === id);
        if (foundProject) {
          // Load media from database
          const dbMedia = await dataService.getProjectPhotos(foundProject.id);

          // Convert ProjectMedia objects to TaggedPhoto format
          const convertedPhotos: TaggedPhoto[] = dbMedia.map((media: any) => ({
            url: media.file_path,
            tags: media.metadata?.tags || [],
            uploadedAt: media.created_at,
            uploadedBy: media.uploaded_by || "Unknown",
            isPrimary: media.is_featured,
            media_type: media.media_type || "image",
            mime_type: media.mime_type,
            file_size: media.file_size,
            // Keep reference to DB media ID for deletion
            _dbId: media.id,
          }));

          // Extract address from client_contact (where EditProject stores it)
          const clientContact = (foundProject as any).client_contact || {};
          // Ensure all required arrays exist
          const projectWithDefaults = {
            ...foundProject,
            address: foundProject.address || clientContact.address || foundProject.metadata?.address || "",
            notes: foundProject.metadata?.notes || foundProject.notes || [],
            activityLog: foundProject.activityLog || [],
            tasks: foundProject.tasks || [],
            checklist: foundProject.checklist || [],
            keywords: foundProject.metadata?.keywords || foundProject.keywords || [],
            photos: convertedPhotos.length > 0 ? convertedPhotos : [],
            documents: foundProject.documents || [],
            additionalPhones: clientContact.additional_phones || foundProject.additionalPhones || [],
          };
          setProject(projectWithDefaults);
        }
      } catch (error) {
        console.error("Error loading project:", error);
      } finally {
        setIsLoadingProject(false);
      }
    };

    loadProject();
  }, [id]);

  const getCurrentUser = () => ({
    id: "current-user",
    name: "Current User",
    platform: navigator.userAgent.includes("Mobile")
      ? "mobile"
      : ("web" as const),
  });

  const addActivityLogEntry = (
    type: string,
    description: string,
    details?: any,
  ) => {
    if (!project) return;

    const user = getCurrentUser();
    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      type,
      description,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      platform: user.platform,
      details,
    };

    const updatedProject = {
      ...project,
      activityLog: [entry, ...(project.activityLog || [])],
    };

    updateProject(updatedProject);
  };

  const getPhotoUrl = (photo: TaggedPhoto | string): string => {
    return typeof photo === "string" ? photo : photo.url;
  };

  const getPhotoTags = (photo: TaggedPhoto | string): string[] => {
    return typeof photo === "string" ? [] : photo.tags;
  };

  const markProjectCompleted = () => {
    if (!project) return;

    const updatedProject = {
      ...project,
      completedDate: new Date().toISOString().split("T")[0],
      status: "completed",
    };

    updateProject(updatedProject);
    addActivityLogEntry("project_completed", "Project marked as completed");
    toast.success("Project marked as completed!");
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this job? This cannot be undone.")) {
      if (!id) return;
      try {
        await dataService.deleteProject(id);
        toast.success("Job deleted successfully");
        navigate("/admin/jobs");
      } catch (err: any) {
        const msg = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
        console.error("Delete failed:", msg, err);
        toast.error(`Delete failed: ${msg || "Unknown error"}`);
      }
    }
  };

  const handleShare = () => {
    shareProject();
  };

  const downloadPhoto = (photoUrl: string, index: number) => {
    const a = document.createElement("a");
    a.href = photoUrl;
    a.download = `${project?.name}-photo-${index + 1}.jpg`;
    a.click();
  };

  const requestGoogleReview = () => {
    setShowReviewRequest(true);
  };

  const handleSendReviewRequest = (
    method: "sms" | "email" | "both",
    message: string,
  ) => {
    const customerName = project?.customerName || "Customer";
    const phone = project?.mobilePhone || project?.customerPhone;
    const email = project?.customerEmail;

    if (method === "sms" || method === "both") {
      if (phone) {
        const phoneUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
        window.open(phoneUrl);
      }
    }

    if (method === "email" || method === "both") {
      if (email) {
        const subject = `Review Request for ${project.name}`;
        const emailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        window.open(emailUrl);
      }
    }

    addActivityLogEntry(
      "review_requested",
      `Google review requested from ${customerName} via ${method}`,
    );
    toast.success(`Review request sent via ${method}!`);
  };

  const handleMediaFilesReady = async (files: any[]) => {
    if (!project) return;

    try {
      const newPhotos: TaggedPhoto[] = [];
      let uploadedCount = 0;

      // Determine if there's already a primary photo among existing photos
      const existingHasPrimary = (project.photos || []).some(
        (p: any) => (typeof p === "object" ? p.isPrimary : false)
      );

      for (const fileWithMetadata of files) {
        try {
          // Extract the actual File object from FileWithMetadata
          const actualFile = fileWithMetadata.file || fileWithMetadata;

          // Parse tags - SmartMediaUploader provides tags as a string
          const tagsArray = typeof fileWithMetadata.tags === "string"
            ? fileWithMetadata.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : fileWithMetadata.tags || [];

          // First uploaded photo becomes primary if no primary exists yet
          const shouldBePrimary = !existingHasPrimary && newPhotos.length === 0;

          // Upload to Supabase
          const uploadedMedia = await dataService.uploadProjectPhoto(project.id, actualFile, {
            tags: tagsArray,
            category: "progress",
            description: fileWithMetadata.description || "",
            is_featured: shouldBePrimary,
          });

          // If this should be primary, set it as featured in DB
          if (shouldBePrimary && uploadedMedia.id) {
            await dataService.setFeaturedMedia(project.id, uploadedMedia.id);
          }

          newPhotos.push({
            url: uploadedMedia.file_path,
            tags: tagsArray,
            uploadedAt: uploadedMedia.created_at,
            uploadedBy: uploadedMedia.uploaded_by || "Unknown",
            isPrimary: shouldBePrimary,
            media_type: uploadedMedia.media_type || "image",
            mime_type: uploadedMedia.mime_type,
            file_size: uploadedMedia.file_size,
            _dbId: uploadedMedia.id,
          });
          uploadedCount++;
        } catch (uploadError) {
          console.error("Error uploading individual photo:", uploadError);
          const fileName = fileWithMetadata.original_name || fileWithMetadata.fileName || "file";
          toast.error(`Failed to upload ${fileName}`);
        }
      }

      if (uploadedCount === 0) {
        toast.error("No photos were uploaded");
        return;
      }

      const updatedProject = {
        ...project,
        photos: [...(project.photos || []), ...newPhotos],
      };

      const entry = {
        id: Date.now().toString(),
        action: "photos_added",
        description: `Added ${uploadedCount} photo(s)`,
        timestamp: new Date().toISOString(),
        user: getCurrentUser()?.name || "Unknown",
        platform: "web" as const,
      };

      const projectWithActivity = {
        ...updatedProject,
        activityLog: [entry, ...(updatedProject.activityLog || [])],
      };

      setProject(projectWithActivity);
      setShowMediaUploader(false);
      toast.success(`Successfully uploaded ${uploadedCount} photo(s)`);
    } catch (error) {
      console.error("Error in handleMediaFilesReady:", error);
      toast.error("Failed to upload photos");
    }
  };

  const handleDocumentUpload = (files: FileList | null) => {
    if (!files || !project) return;

    const newDocuments: ProjectDocument[] = Array.from(files).map((file) => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: getCurrentUser()?.name || "Unknown",
      url: URL.createObjectURL(file), // In real app, this would be uploaded to cloud storage
    }));

    const updatedProject = {
      ...project,
      documents: [...(project.documents || []), ...newDocuments],
    };

    const entry = {
      id: Date.now().toString(),
      action: "documents_added",
      description: `Added ${newDocuments.length} document(s): ${newDocuments.map((d) => d.name).join(", ")}`,
      timestamp: new Date().toISOString(),
      user: getCurrentUser()?.name || "Unknown",
      platform: "web" as const,
    };

    const projectWithActivity = {
      ...updatedProject,
      activityLog: [entry, ...(updatedProject.activityLog || [])],
    };

    updateProject(projectWithActivity);
    toast.success(`Added ${newDocuments.length} document(s) to the project`);
  };

  const addMorePhotos = async (files: FileList | null) => {
    if (!files || !project) return;

    try {
      const newPhotos: TaggedPhoto[] = [];
      let uploadedCount = 0;

      const existingHasPrimary = (project.photos || []).some(
        (p: any) => (typeof p === "object" ? p.isPrimary : false)
      );

      for (const file of Array.from(files)) {
        try {
          const shouldBePrimary = !existingHasPrimary && newPhotos.length === 0;

          // Upload to Supabase (accepts both images and videos)
          const uploadedMedia = await dataService.uploadProjectPhoto(project.id, file, {
            category: "progress",
          });

          if (shouldBePrimary && uploadedMedia.id) {
            await dataService.setFeaturedMedia(project.id, uploadedMedia.id);
          }

          // Convert returned ProjectMedia to TaggedPhoto
          newPhotos.push({
            url: uploadedMedia.file_path,
            tags: [],
            uploadedAt: uploadedMedia.created_at,
            uploadedBy: uploadedMedia.uploaded_by || "Unknown",
            isPrimary: shouldBePrimary,
            media_type: uploadedMedia.media_type || "image",
            mime_type: uploadedMedia.mime_type,
            file_size: uploadedMedia.file_size,
            _dbId: uploadedMedia.id,
          });
          uploadedCount++;
        } catch (uploadError) {
          console.error("Error uploading individual photo:", uploadError);
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      if (uploadedCount === 0) {
        toast.error("No photos were uploaded");
        return;
      }

      const updatedProject = {
        ...project,
        photos: [...(project.photos || []), ...newPhotos],
      };

      updateProject(updatedProject);
      addActivityLogEntry(
        "photos_added",
        `Added ${uploadedCount} new photo(s)`,
      );
      toast.success(`Added ${uploadedCount} new photo(s)`);
    } catch (error) {
      console.error("Error in addMorePhotos:", error);
      toast.error("Failed to upload photos");
    }
  };

  const removePhoto = async (index: number) => {
    if (!project) return;

    if (confirm("Are you sure you want to remove this photo?")) {
      try {
        const photo = project.photos[index];
        const dbId = typeof photo === "object" ? (photo as any)._dbId : null;

        // Delete from database if we have the ID
        if (dbId) {
          await dataService.deleteProjectPhoto(dbId);
        }

        const updatedPhotos = project.photos.filter((_, i) => i !== index);
        const updatedProject = {
          ...project,
          photos: updatedPhotos,
        };

        setProject(updatedProject);
        addActivityLogEntry("photo_removed", "Photo removed from project");
        toast.success("Photo removed successfully");
      } catch (error) {
        console.error("Error removing photo:", error);
        toast.error("Failed to remove photo");
      }
    }
  };

  const togglePhotoSelection = (index: number) => {
    setSelectedPhotos((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const selectAllPhotos = () => {
    setSelectedPhotos(
      selectedPhotos.length === project?.photos.length
        ? []
        : Array.from({ length: project?.photos.length || 0 }, (_, i) => i),
    );
  };

  const downloadSelectedPhotos = () => {
    if (!project || selectedPhotos.length === 0) return;

    selectedPhotos.forEach((index) => {
      const photo = project.photos[index];
      const photoUrl = getPhotoUrl(photo);
      downloadPhoto(photoUrl, index);
    });
    addActivityLogEntry(
      "photos_downloaded",
      `Downloaded ${selectedPhotos.length} photos`,
    );
    toast.success(`Downloaded ${selectedPhotos.length} photos`);
    setSelectedPhotos([]);
  };

  // Note Management Functions
  const addNote = async () => {
    if (!project || !newNote.trim()) return;

    const note: ProjectNote = {
      id: Date.now().toString(),
      content: newNote,
      createdAt: new Date().toISOString(),
      createdBy: getCurrentUser().name,
    };

    const updatedNotes = [note, ...(project.notes || [])];

    try {
      const existingMetadata = (project as any).metadata || {};
      await dataService.updateProject(project.id, {
        metadata: { ...existingMetadata, notes: updatedNotes },
      } as any);
      setProject({ ...project, notes: updatedNotes });
      setNewNote("");
      setShowAddNote(false);
      toast.success("Note added successfully");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    }
  };

  const editNote = async (noteId: string, newContent: string) => {
    if (!project || !project.notes || !newContent.trim()) return;

    const updatedNotes = project.notes.map((note) =>
      note.id === noteId
        ? { ...note, content: newContent, updatedAt: new Date().toISOString() }
        : note,
    );

    try {
      const existingMetadata = (project as any).metadata || {};
      await dataService.updateProject(project.id, {
        metadata: { ...existingMetadata, notes: updatedNotes },
      } as any);
      setProject({ ...project, notes: updatedNotes });
      setEditingNote(null);
      toast.success("Note updated successfully");
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Failed to update note");
    }
  };

  const deleteNote = async (noteId: string) => {
    if (
      !project ||
      !project.notes ||
      !confirm("Are you sure you want to delete this note?")
    )
      return;

    const updatedNotes = project.notes.filter((note) => note.id !== noteId);

    try {
      const existingMetadata = (project as any).metadata || {};
      await dataService.updateProject(project.id, {
        metadata: { ...existingMetadata, notes: updatedNotes },
      } as any);
      setProject({ ...project, notes: updatedNotes });
      toast.success("Note deleted successfully");
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
  };

  // Task Management Functions
  const addTask = () => {
    if (!project || !newTask.title.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      ...newTask,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const user = getCurrentUser();
    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      type: "task_added",
      description: `Task "${task.title}" assigned to ${task.assignedTo || "unassigned"}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      platform: user.platform,
    };

    const updatedProject = {
      ...project,
      tasks: [...(project.tasks || []), task],
      activityLog: [entry, ...(project.activityLog || [])],
    };

    updateProject(updatedProject);
    setNewTask({ title: "", assignedTo: "", dueDate: "", dueTime: "" });
    setShowAddTask(false);
    toast.success("Task added successfully");
  };

  const toggleTask = (taskId: string) => {
    if (!project || !project.tasks) return;

    const user = getCurrentUser();
    const task = project.tasks.find((t) => t.id === taskId);
    const updatedTasks = project.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            completed: !task.completed,
            completedAt: !task.completed ? new Date().toISOString() : undefined,
            completedBy: !task.completed ? user.name : undefined,
          }
        : task,
    );

    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      type: "task_toggled",
      description: `Task "${task?.title}" marked as ${!task?.completed ? "completed" : "incomplete"}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      platform: user.platform,
    };

    const updatedProject = {
      ...project,
      tasks: updatedTasks,
      activityLog: [entry, ...(project.activityLog || [])],
    };

    updateProject(updatedProject);
  };

  const editTask = (taskId: string, updatedTask: Partial<Task>) => {
    if (!project || !project.tasks) return;

    const updatedTasks = project.tasks.map((task) =>
      task.id === taskId ? { ...task, ...updatedTask } : task,
    );

    updateProject({ ...project, tasks: updatedTasks });
    addActivityLogEntry("task_edited", `Task "${updatedTask.title}" updated`);
    setEditingTask(null);
    toast.success("Task updated successfully");
  };

  const deleteTask = (taskId: string) => {
    if (
      !project ||
      !project.tasks ||
      !confirm("Are you sure you want to delete this task?")
    )
      return;

    const task = project.tasks.find((t) => t.id === taskId);
    const updatedTasks = project.tasks.filter((task) => task.id !== taskId);

    const user = getCurrentUser();
    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      type: "task_deleted",
      description: `Task "${task?.title}" deleted`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      platform: user.platform,
    };

    const updatedProject = {
      ...project,
      tasks: updatedTasks,
      activityLog: [entry, ...(project.activityLog || [])],
    };

    updateProject(updatedProject);
    toast.success("Task deleted successfully");
  };

  // Checklist Management Functions
  const addChecklistItem = () => {
    if (!project || !newChecklistItem.trim()) return;

    const item: ChecklistItem = {
      id: Date.now().toString(),
      title: newChecklistItem,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const user = getCurrentUser();
    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      type: "checklist_item_added",
      description: `Checklist item "${item.title}" added`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      platform: user.platform,
    };

    const updatedProject = {
      ...project,
      checklist: [...(project.checklist || []), item],
      activityLog: [entry, ...(project.activityLog || [])],
    };

    updateProject(updatedProject);
    setNewChecklistItem("");
    setShowAddChecklist(false);
    toast.success("Checklist item added");
  };

  const toggleChecklistItem = (itemId: string) => {
    if (!project || !project.checklist) return;

    const user = getCurrentUser();
    const item = project.checklist.find((i) => i.id === itemId);
    const updatedChecklist = project.checklist.map((item) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
            completedAt: !item.completed ? new Date().toISOString() : undefined,
            completedBy: !item.completed ? user.name : undefined,
          }
        : item,
    );

    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      type: "checklist_item_toggled",
      description: `Checklist item "${item?.title}" marked as ${!item?.completed ? "completed" : "incomplete"}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      platform: user.platform,
    };

    const updatedProject = {
      ...project,
      checklist: updatedChecklist,
      activityLog: [entry, ...(project.activityLog || [])],
    };

    updateProject(updatedProject);
  };

  const editChecklistItem = (itemId: string, newTitle: string) => {
    if (!project || !project.checklist || !newTitle.trim()) return;

    const updatedChecklist = project.checklist.map((item) =>
      item.id === itemId ? { ...item, title: newTitle } : item,
    );

    updateProject({ ...project, checklist: updatedChecklist });
    addActivityLogEntry(
      "checklist_item_edited",
      `Checklist item updated to "${newTitle}"`,
    );
    setEditingChecklistItem(null);
    toast.success("Checklist item updated");
  };

  const deleteChecklistItem = (itemId: string) => {
    if (
      !project ||
      !project.checklist ||
      !confirm("Are you sure you want to delete this checklist item?")
    )
      return;

    const item = project.checklist.find((i) => i.id === itemId);
    const updatedChecklist = project.checklist.filter(
      (item) => item.id !== itemId,
    );

    const user = getCurrentUser();
    const entry: ActivityLogEntry = {
      id: Date.now().toString(),
      type: "checklist_item_deleted",
      description: `Checklist item "${item?.title}" deleted`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      platform: user.platform,
    };

    const updatedProject = {
      ...project,
      checklist: updatedChecklist,
      activityLog: [entry, ...(project.activityLog || [])],
    };

    updateProject(updatedProject);
    toast.success("Checklist item deleted");
  };

  // Mention System Functions
  const handleMentionInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    const textUpToCursor = value.substring(0, cursorPos);
    const lastAtIndex = textUpToCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textUpToCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(" ") && textAfterAt.length <= 20) {
        setMentionQuery(textAfterAt);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }

    setNewNote(value);
  };

  const insertMention = (user: (typeof mockUsers)[0]) => {
    const cursorPos = newNote.lastIndexOf("@" + mentionQuery);
    const beforeMention = newNote.substring(0, cursorPos);
    const afterMention = newNote.substring(cursorPos + mentionQuery.length + 1);

    setNewNote(`${beforeMention}@${user.name} ${afterMention}`);
    setShowMentionDropdown(false);
    setMentionQuery("");
  };

  const startRenameDoc = (doc: ProjectDocument) => {
    setRenamingDocId(doc.id);
    setRenameDocValue(doc.name);
  };

  const saveRenameDoc = async () => {
    if (!project || !renamingDocId || !renameDocValue.trim()) return;
    const newName = renameDocValue.trim();
    const updatedDocs = project.documents.map((d) =>
      d.id === renamingDocId ? { ...d, name: newName } : d
    );
    const updatedProject = {
      ...project,
      documents: updatedDocs,
      metadata: { ...(project.metadata || {}), documents: updatedDocs },
    };
    setProject(updatedProject);
    setRenamingDocId(null);
    setRenameDocValue("");
    try {
      await dataService.updateProject(project.id, { metadata: updatedProject.metadata });
      toast.success("Document renamed");
    } catch (error) {
      console.error("Error renaming document:", error);
      toast.error("Failed to rename document");
    }
  };

  const cancelRenameDoc = () => {
    setRenamingDocId(null);
    setRenameDocValue("");
  };

  const deleteDocument = async (docId: string) => {
    if (!project || !confirm("Are you sure you want to delete this document?")) return;
    const updatedDocs = project.documents.filter((d) => d.id !== docId);
    const updatedProject = {
      ...project,
      documents: updatedDocs,
      metadata: { ...(project.metadata || {}), documents: updatedDocs },
    };
    setProject(updatedProject);
    try {
      await dataService.updateProject(project.id, { metadata: updatedProject.metadata });
      toast.success("Document deleted");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const saveFieldEdit = async (field: "name" | "description" | "address", value: string) => {
    if (!project) return;
    const trimmed = value.trim();
    setProject({ ...project, [field]: trimmed });
    try {
      if (field === "name") {
        await dataService.updateProject(project.id, { name: trimmed });
      } else if (field === "description") {
        await dataService.updateProject(project.id, { description: trimmed });
      } else if (field === "address") {
        const existingContact = (project as any).client_contact || {};
        await dataService.updateProject(project.id, {
          client_contact: { ...existingContact, address: trimmed },
        });
      }
      toast.success("Saved");
    } catch (err) {
      console.error("Failed to save field:", err);
      toast.error("Failed to save");
    }
  };

  const saveContactEdit = async () => {
    if (!project) return;
    const existingContact = (project as any).client_contact || {};
    const updatedContact = {
      ...existingContact,
      name: editContactName.trim(),
      phone: editContactPhone.trim(),
      email: editContactEmail.trim(),
    };
    try {
      await dataService.updateProject(project.id, { client_contact: updatedContact });
      setProject({ ...project, client_contact: updatedContact } as any);
      setEditingContact(false);
      toast.success("Customer details saved");
    } catch (err) {
      console.error("Failed to save contact:", err);
      toast.error("Failed to save customer details");
    }
  };

  const addKeyword = async () => {
    if (!project || !newKeyword.trim()) return;
    const trimmed = newKeyword.trim();
    if (project.keywords.includes(trimmed)) {
      toast.error("Keyword already exists");
      return;
    }
    const updatedKeywords = [...project.keywords, trimmed];
    const updatedProject = {
      ...project,
      keywords: updatedKeywords,
      metadata: { ...(project.metadata || {}), keywords: updatedKeywords },
    };
    setProject(updatedProject);
    setNewKeyword("");
    setShowAddKeyword(false);
    try {
      await dataService.updateProject(project.id, { metadata: updatedProject.metadata });
      toast.success(`Keyword "${trimmed}" added`);
    } catch (error) {
      console.error("Error saving keyword:", error);
      toast.error("Failed to save keyword");
    }
  };

  const removeKeyword = async (keyword: string) => {
    if (!project) return;
    const updatedKeywords = project.keywords.filter((k) => k !== keyword);
    const updatedProject = {
      ...project,
      keywords: updatedKeywords,
      metadata: { ...(project.metadata || {}), keywords: updatedKeywords },
    };
    setProject(updatedProject);
    try {
      await dataService.updateProject(project.id, { metadata: updatedProject.metadata });
      toast.success(`Keyword "${keyword}" removed`);
    } catch (error) {
      console.error("Error removing keyword:", error);
      toast.error("Failed to remove keyword");
    }
  };

  const updateProject = async (updatedProject: Project) => {
    try {
      await dataService.updateProject(updatedProject.id, updatedProject);
      setProject({ ...updatedProject });
    } catch (error) {
      console.error("Error updating project:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to update project: ${errorMessage}`);
    }
  };

  const shareProject = () => {
    const publicUrl = `${window.location.origin}/public/job/${project?.id}`;
    navigator.clipboard.writeText(publicUrl);
    addActivityLogEntry("project_shared", "Project link shared");
    toast.success("Public project link copied to clipboard");
  };

  const handlePhotoEdit = (photo: any) => {
    toast.info("Edit functionality coming soon!");
  };

  const handlePhotoDelete = (photo: any) => {
    if (!project || confirm("Are you sure you want to delete this photo?")) {
      try {
        const photoUrl = typeof photo === "string" ? photo : photo.url;
        const updatedPhotos = project.photos.filter(
          (p: any) => (typeof p === "string" ? p : p.url) !== photoUrl,
        );

        const updatedProject = {
          ...project,
          photos: updatedPhotos,
        };

        updateProject(updatedProject);
        addActivityLogEntry("photo_deleted", "Photo deleted from project");
        toast.success("Photo deleted successfully");
      } catch (error) {
        console.error("Error deleting photo:", error);
        toast.error("Failed to delete photo");
      }
    }
  };

  const handlePhotoToggleFavorite = async (photo: any) => {
    if (!project) return;

    try {
      const photoUrl = typeof photo === "string" ? photo : photo.url;
      const photoObj = project.photos.find(
        (p: any) => (typeof p === "string" ? p : p.url) === photoUrl,
      ) as any;
      const currentIsPrimary = typeof photoObj === "object" ? !!photoObj.isPrimary : false;
      const dbId = typeof photoObj === "object" ? photoObj._dbId : null;

      if (currentIsPrimary) {
        // Unstar: just clear this one
        if (dbId) await dataService.clearFeaturedMedia(dbId);
        const updatedPhotos = project.photos.map((p: any) =>
          (typeof p === "string" ? p : p.url) === photoUrl
            ? { ...p, isPrimary: false }
            : p
        );
        // Build the complete updated project in one shot to avoid stale-closure overwrites
        setProject({ ...project, photos: updatedPhotos });
        toast.success("Removed as primary photo");
      } else {
        // Star: set this as the only primary, clear all others
        if (dbId) await dataService.setFeaturedMedia(project.id, dbId);
        const updatedPhotos = project.photos.map((p: any) => {
          const url = typeof p === "string" ? p : p.url;
          return typeof p === "object"
            ? { ...p, isPrimary: url === photoUrl }
            : p;
        });
        // Build the complete updated project in one shot to avoid stale-closure overwrites
        setProject({ ...project, photos: updatedPhotos });
        toast.success("Set as primary photo");
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update primary photo");
    }
  };

  const handlePhotoDownload = (photo: any) => {
    const photoUrl = typeof photo === "string" ? photo : photo.url;
    const a = document.createElement("a");
    a.href = photoUrl;
    a.download = `${project?.name || "project"}-photo.jpg`;
    a.click();
  };

  const handlePhotoViewDetails = (photo: any) => {
    const photoUrl = typeof photo === "string" ? photo : photo.url;
    setSelectedPhoto(photoUrl);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getFilteredUsers = () => {
    return mockUsers.filter((user) =>
      user.name.toLowerCase().includes(mentionQuery.toLowerCase()),
    );
  };

  if (isLoadingProject) {
    return (
      <AppLayout>
        <div className="container px-4 py-6 max-w-full overflow-x-hidden">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" disabled>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-4">
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
            <div className="h-64 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="container px-4 py-6 max-w-full overflow-x-hidden">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/admin/jobs">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Job Not Found</h1>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Job not found</p>
              <Link to="/admin/jobs">
                <Button className="mt-4">Back to Jobs</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <React.Fragment key={`project-detail-fragment-${project.id}`}>
        <div
          className="w-full px-3 sm:px-4 py-6 max-w-full overflow-x-hidden min-w-0"
          key={`project-detail-${project.id}`}
        >
          <div key="project-detail-content">
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6"
              key="header-nav"
            >
              <div className="flex items-center gap-4 flex-1">
                <Link to="/admin/jobs" key="back-link">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div className="flex-1 min-w-0" key="title-section">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            saveFieldEdit("name", editNameValue);
                            setEditingName(false);
                          }
                          if (e.key === "Escape") setEditingName(false);
                        }}
                        className="text-xl sm:text-2xl font-bold border-b-2 border-primary bg-transparent focus:outline-none w-full"
                      />
                      <Button size="sm" onClick={() => { saveFieldEdit("name", editNameValue); setEditingName(false); }}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/name">
                      <h1 className="text-xl sm:text-2xl font-bold truncate">
                        {project.name}
                      </h1>
                      <button
                        onClick={() => { setEditNameValue(project.name); setEditingName(true); }}
                        className="opacity-0 group-hover/name:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        title="Edit project name"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                            Actions
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={handleShare}>
                            <Share className="h-4 w-4 mr-2" />
                            Share Project
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditNameValue(project.name); setEditingName(true); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Rename Project
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Upload to Website
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Post to Google My Business
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleDelete}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {/* Customer contact info */}
                  {editingContact ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Customer name"
                        value={editContactName}
                        onChange={(e) => setEditContactName(e.target.value)}
                        className="border-b border-primary bg-transparent text-sm focus:outline-none w-32"
                      />
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={editContactPhone}
                        onChange={(e) => setEditContactPhone(e.target.value)}
                        className="border-b border-primary bg-transparent text-sm focus:outline-none w-32"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={editContactEmail}
                        onChange={(e) => setEditContactEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveContactEdit();
                          if (e.key === "Escape") setEditingContact(false);
                        }}
                        className="border-b border-primary bg-transparent text-sm focus:outline-none w-40"
                      />
                      <Button size="sm" className="h-6 text-xs px-2" onClick={saveContactEdit}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingContact(false)}>Cancel</Button>
                    </div>
                  ) : (() => {
                      const cc = (project as any).client_contact || {};
                      const name = cc.name || cc.contact_name || "";
                      const phone = cc.phone || cc.contact_phone || "";
                      const email = cc.email || cc.contact_email || "";
                      const hasData = name || phone || email;
                      const openEdit = () => {
                        setEditContactName(name);
                        setEditContactPhone(phone);
                        setEditContactEmail(email);
                        setEditingContact(true);
                      };
                      return hasData ? (
                        <div className="flex flex-col gap-0.5 mt-1 group/contact">
                          {name && (
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                              <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span>{name}</span>
                            </div>
                          )}
                          {phone && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              <a href={`tel:${phone}`} className="hover:text-foreground transition-colors" onClick={(e) => e.stopPropagation()}>{phone}</a>
                            </div>
                          )}
                          {email && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <a href={`mailto:${email}`} className="hover:text-foreground transition-colors" onClick={(e) => e.stopPropagation()}>{email}</a>
                            </div>
                          )}
                          <button
                            onClick={openEdit}
                            className="self-start mt-0.5 opacity-0 group-hover/contact:opacity-100 transition-opacity text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                          >
                            <Edit className="h-3 w-3" /> Edit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={openEdit}
                          className="mt-1 text-sm text-muted-foreground/60 italic hover:text-muted-foreground transition-colors text-left"
                        >
                          + Add customer name, phone &amp; email
                        </button>
                      );
                    })()}
                  <div
                    className="flex items-center gap-2 text-muted-foreground mt-0.5"
                    key="address-display"
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate text-sm">{project.address}</span>
                  </div>
                </div>
              </div>
              <div
                className="flex items-center gap-2 flex-shrink-0"
                key="action-buttons"
              >
                <DropdownMenu key="actions-dropdown">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem key="share-project" onClick={handleShare}>
                      <Share className="h-4 w-4 mr-2" />
                      Share Project
                    </DropdownMenuItem>
                    <DropdownMenuItem key="upload-website">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Upload to Website
                    </DropdownMenuItem>
                    <DropdownMenuItem key="post-google">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Post to Google My Business
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      key="delete-project"
                      onClick={handleDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Project Status and Completion */}
            <div key="project-status-wrapper">
              {project.status !== "completed" ? (
                <Card className="mb-6" key="project-status-active">
                  <CardContent className="p-4" key="status-active-content">
                    <div
                      className="flex items-center justify-between"
                      key="status-active-inner"
                    >
                      <div key="status-text">
                        <h3 className="font-medium">Project Status</h3>
                        <p className="text-sm text-muted-foreground">
                          <span key="start-date-text">
                            Started:{" "}
                            {new Date(
                              project.startDate || project.createdAt,
                            ).toLocaleDateString()}
                          </span>
                          {project.completionDate && (
                            <span key="expected-completion">
                              {" "}
                              • Expected:{" "}
                              {new Date(
                                project.completionDate,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button onClick={markProjectCompleted} className="gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Mark Completed
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card
                  className="mb-6 border-green-200 bg-green-50"
                  key="project-status-completed"
                >
                  <CardContent className="p-4" key="status-completed-content">
                    <div
                      className="flex items-center gap-2"
                      key="status-completed-inner"
                    >
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div key="completion-text">
                        <h3 className="font-medium text-green-800">
                          Project Completed
                        </h3>
                        <p className="text-sm text-green-700">
                          <span key="completion-date-text">
                            Completed on{" "}
                            {project.completedDate
                              ? new Date(
                                  project.completedDate,
                                ).toLocaleDateString()
                              : "Unknown"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b mb-6">
              <div className="flex space-x-1 overflow-x-auto scrollbar-hide pb-1">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "tasks", label: "Tasks & Checklists" },
                  { id: "documents", label: "Documents" },
                  { id: "activity", label: "Activity Log" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-6" key="overview-tab-content">
                    {/* Project Description */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle>Project Description</CardTitle>
                        {!editingDescription && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditDescriptionValue(project.description || ""); setEditingDescription(true); }}
                            title="Edit description"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent>
                        {editingDescription ? (
                          <div className="space-y-2">
                            <Textarea
                              autoFocus
                              value={editDescriptionValue}
                              onChange={(e) => setEditDescriptionValue(e.target.value)}
                              rows={4}
                              className="w-full"
                              placeholder="Project description…"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => { saveFieldEdit("description", editDescriptionValue); setEditingDescription(false); }}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingDescription(false)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            {project.description || "No description provided"}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Project Keywords/Tags */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Tag className="h-5 w-5" />
                          Project Keywords
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {project.keywords && project.keywords.length > 0 ? (
                            project.keywords.map((keyword, index) => (
                              <Badge
                                key={`keyword-${index}-${keyword.replace(/\s+/g, "-")}`}
                                variant="secondary"
                                className="cursor-pointer hover:bg-secondary/80"
                              >
                                <span>{keyword}</span>
                                <button
                                  className="ml-1 hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeKeyword(keyword);
                                  }}
                                >
                                  ×
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No keywords added
                            </span>
                          )}
                          {/* Add keyword inline input */}
                          {showAddKeyword ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                type="text"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") addKeyword();
                                  if (e.key === "Escape") {
                                    setShowAddKeyword(false);
                                    setNewKeyword("");
                                  }
                                }}
                                placeholder="New keyword…"
                                className="text-sm border rounded px-2 py-0.5 w-32 focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <button
                                onClick={addKeyword}
                                className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => { setShowAddKeyword(false); setNewKeyword(""); }}
                                className="text-xs px-2 py-0.5 rounded hover:bg-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <Badge
                              key="add-keyword-button"
                              variant="outline"
                              className="cursor-pointer hover:bg-muted"
                              onClick={() => setShowAddKeyword(true)}
                            >
                              + Add Keyword
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Images className="h-5 w-5" />
                          Photos & Video ({project.photos.length})
                          {selectedPhotos.length > 0 && (
                            <Badge variant="secondary">
                              {selectedPhotos.length} selected
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {selectedPhotos.length > 0 && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={downloadSelectedPhotos}
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={shareProject}
                                className="gap-2"
                              >
                                <Share className="h-4 w-4" />
                                Share
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={selectAllPhotos}
                              >
                                {selectedPhotos.length === project.photos.length
                                  ? "Deselect All"
                                  : "Select All"}
                              </Button>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setShowMediaUploader(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Add Media
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {project.photos.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {project.photos.map((photo, index) => {
                              const photoUrl = getPhotoUrl(photo);
                              const photoTags = getPhotoTags(photo);
                              const isVideo = typeof photo === "object" && photo.media_type === "video";
                              return (
                                <div
                                  key={`photo-${index}-${photoUrl.slice(-10)}`}
                                  className={`group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted shadow-sm hover:shadow-lg transition-shadow ${
                                    selectedPhotos.includes(index)
                                      ? "ring-2 ring-primary"
                                      : ""
                                  }`}
                                  onClick={() => setSelectedPhoto(photoUrl)}
                                >
                                  {isVideo ? (
                                    <>
                                      <video
                                        src={photoUrl}
                                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedPhoto(photoUrl);
                                        }}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors pointer-events-none">
                                        <Video className="h-12 w-12 text-white" />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <ImageWithFallback
                                        photo={photo}
                                        alt={`Photo ${index + 1}`}
                                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedPhoto(photoUrl);
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                    </>
                                  )}

                                  {/* Top-left controls: checkbox + star */}
                                  <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                                    <Checkbox
                                      checked={selectedPhotos.includes(index)}
                                      onCheckedChange={() =>
                                        togglePhotoSelection(index)
                                      }
                                      className="bg-white/80 border-white"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {(() => {
                                      const isPrimary = typeof photo === "object" ? !!photo.isPrimary : false;
                                      return (
                                        <button
                                          className={`rounded-full p-0.5 transition-all ${
                                            isPrimary
                                              ? "opacity-100 bg-black/40"
                                              : "opacity-0 group-hover:opacity-100 bg-black/40"
                                          }`}
                                          title={isPrimary ? "Primary photo – click to unset" : "Set as primary photo"}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePhotoToggleFavorite(photo);
                                          }}
                                        >
                                          <Star
                                            className={`h-4 w-4 transition-colors ${
                                              isPrimary
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "text-white"
                                            }`}
                                          />
                                        </button>
                                      );
                                    })()}
                                  </div>

                                  {/* Primary badge label */}
                                  {typeof photo === "object" && photo.isPrimary && (
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                      <span className="text-[10px] font-semibold bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                                        Primary
                                      </span>
                                    </div>
                                  )}

                                  {photoTags.length > 0 && (
                                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-1">
                                      {photoTags
                                        .slice(0, 2)
                                        .map((tag, tagIndex) => (
                                          <Badge
                                            key={`photo-${index}-tag-${tagIndex}-${tag.replace(/\s+/g, "-").toLowerCase()}`}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {tag}
                                          </Badge>
                                        ))}
                                      {photoTags.length > 2 && (
                                        <Badge
                                          key={`photo-${index}-more-tags`}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          +{photoTags.length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  <div className="absolute top-2 right-2 opacity-90 group-hover:opacity-100 transition-opacity">
                                    <PhotoActionMenu
                                      photo={photo}
                                      index={index}
                                      projectName={project.name}
                                      onEdit={handlePhotoEdit}
                                      onDelete={handlePhotoDelete}
                                      onToggleFavorite={
                                        handlePhotoToggleFavorite
                                      }
                                      onDownload={handlePhotoDownload}
                                      onViewDetails={handlePhotoViewDetails}
                                      isFavorite={
                                        typeof photo === "object"
                                          ? photo.isPrimary
                                          : false
                                      }
                                      className="h-6 w-6"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <Images className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No media uploaded yet</p>
                            <Button
                              variant="outline"
                              className="mt-4 gap-2"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Plus className="h-4 w-4" />
                              Add First Media
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Google Map Section */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Project Location
                        </CardTitle>
                        {!editingAddress && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditAddressValue(project.address || ""); setEditingAddress(true); }}
                            title="Edit address"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {editingAddress ? (
                            <div className="space-y-2">
                              <input
                                autoFocus
                                type="text"
                                value={editAddressValue}
                                onChange={(e) => setEditAddressValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { saveFieldEdit("address", editAddressValue); setEditingAddress(false); }
                                  if (e.key === "Escape") setEditingAddress(false);
                                }}
                                placeholder="Enter address…"
                                className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => { saveFieldEdit("address", editAddressValue); setEditingAddress(false); }}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingAddress(false)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(project.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {project.address}
                            </a>
                          </div>
                          )}
                          {project.gpsLat && project.gpsLng && (
                            <div className="text-sm text-muted-foreground">
                              <span key="gps-label" className="font-medium">
                                GPS:
                              </span>
                              <span key="gps-coordinates">
                                {" "}
                                {project.gpsLat}, {project.gpsLng}
                              </span>
                            </div>
                          )}
                          <SafeGoogleMapComponent
                            address={project.address}
                            lat={project.gpsLat}
                            lng={project.gpsLng}
                            height="256px"
                            zoom={15}
                            showControls={true}
                            showDirectionsButton={true}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Street View Section */}
                    <StreetView
                      streetViewUrl={project.streetViewUrl}
                      hasStreetView={project.hasStreetView}
                      address={
                        project.address ||
                        `${project.streetAddress}, ${project.city}, ${project.state} ${project.zipCode}`
                      }
                      className="w-full"
                    />

                    {/* Notes Section */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Project Notes</CardTitle>
                        <Button
                          onClick={() => setShowAddNote(true)}
                          size="sm"
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Note
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {showAddNote && (
                          <div className="border rounded-lg p-4 mb-4 space-y-3">
                            <div className="relative">
                              <Textarea
                                placeholder="Add a note... Use @ to mention users"
                                value={newNote}
                                onChange={handleMentionInput}
                                rows={4}
                              />
                              {showMentionDropdown &&
                                getFilteredUsers().length > 0 && (
                                  <div className="absolute top-full left-0 right-0 bg-white border rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {getFilteredUsers().map((user) => (
                                      <div
                                        key={user.id}
                                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                                        onClick={() => insertMention(user)}
                                      >
                                        <AtSign className="h-4 w-4" />
                                        <span>{user.name}</span>
                                        <span className="text-sm text-muted-foreground">
                                          {user.email}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={addNote} size="sm">
                                Add Note
                              </Button>
                              <Button
                                onClick={() => {
                                  setShowAddNote(false);
                                  setNewNote("");
                                  setShowMentionDropdown(false);
                                }}
                                variant="outline"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-4">
                          {project.notes &&
                          Array.isArray(project.notes) &&
                          project.notes.length > 0 ? (
                            project.notes.map((note) => (
                              <div
                                key={note.id}
                                className="border rounded-lg p-4"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">
                                      {note.createdBy}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatTimestamp(note.createdAt)}
                                    </span>
                                    {note.updatedAt && (
                                      <span className="text-xs text-muted-foreground">
                                        (edited)
                                      </span>
                                    )}
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => setEditingNote(note.id)}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => deleteNote(note.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                {editingNote === note.id ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      defaultValue={note.content}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && e.ctrlKey) {
                                          editNote(
                                            note.id,
                                            e.currentTarget.value,
                                          );
                                        }
                                      }}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          const textarea = e.currentTarget
                                            .parentElement
                                            ?.previousElementSibling as HTMLTextAreaElement;
                                          editNote(note.id, textarea.value);
                                        }}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingNote(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm whitespace-pre-wrap">
                                    {note.content}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No notes added yet</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Tasks & Checklists Tab */}
                {activeTab === "tasks" && (
                  <div className="space-y-6" key="tasks-tab-content">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Tasks</CardTitle>
                        <Button
                          onClick={() => setShowAddTask(true)}
                          size="sm"
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Task
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {showAddTask && (
                          <div className="border rounded-lg p-4 mb-4 space-y-3">
                            <Input
                              placeholder="Task title"
                              value={newTask.title}
                              onChange={(e) =>
                                setNewTask((prev) => ({
                                  ...prev,
                                  title: e.target.value,
                                }))
                              }
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <Select
                                value={newTask.assignedTo}
                                onValueChange={(value) =>
                                  setNewTask((prev) => ({
                                    ...prev,
                                    assignedTo: value,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Assign to..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {mockUsers.map((user) => (
                                    <SelectItem key={user.id} value={user.name}>
                                      {user.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="date"
                                placeholder="Due date"
                                value={newTask.dueDate}
                                onChange={(e) =>
                                  setNewTask((prev) => ({
                                    ...prev,
                                    dueDate: e.target.value,
                                  }))
                                }
                              />
                              <Input
                                type="time"
                                placeholder="Due time"
                                value={newTask.dueTime}
                                onChange={(e) =>
                                  setNewTask((prev) => ({
                                    ...prev,
                                    dueTime: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={addTask} size="sm">
                                Add Task
                              </Button>
                              <Button
                                onClick={() => setShowAddTask(false)}
                                variant="outline"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          {project.tasks &&
                          Array.isArray(project.tasks) &&
                          project.tasks.length > 0 ? (
                            project.tasks.map((task) => (
                              <div
                                key={task.id}
                                className="flex items-start justify-between p-3 border rounded-lg"
                              >
                                <div className="flex items-start gap-3 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={!!task.completed}
                                    onChange={() => toggleTask(task.id)}
                                    className="rounded mt-1"
                                  />
                                  <div className="flex-1">
                                    {editingTask === task.id ? (
                                      <div className="space-y-2">
                                        <Input
                                          defaultValue={task.title}
                                          placeholder="Task title"
                                        />
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                          <Select
                                            defaultValue={task.assignedTo}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Assign to..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {mockUsers.map((user) => (
                                                <SelectItem
                                                  key={user.id}
                                                  value={user.name}
                                                >
                                                  {user.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <Input
                                            type="date"
                                            defaultValue={task.dueDate}
                                          />
                                          <Input
                                            type="time"
                                            defaultValue={task.dueTime}
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={(e) => {
                                              const container =
                                                e.currentTarget.closest(
                                                  ".space-y-2",
                                                );
                                              const titleInput =
                                                container?.querySelector(
                                                  'input[placeholder="Task title"]',
                                                ) as HTMLInputElement;
                                              const assignSelect =
                                                container?.querySelector(
                                                  "select",
                                                ) as HTMLSelectElement;
                                              const dateInput =
                                                container?.querySelector(
                                                  'input[type="date"]',
                                                ) as HTMLInputElement;
                                              const timeInput =
                                                container?.querySelector(
                                                  'input[type="time"]',
                                                ) as HTMLInputElement;

                                              editTask(task.id, {
                                                title:
                                                  titleInput?.value ||
                                                  task.title,
                                                assignedTo:
                                                  assignSelect?.value ||
                                                  task.assignedTo,
                                                dueDate:
                                                  dateInput?.value ||
                                                  task.dueDate,
                                                dueTime:
                                                  timeInput?.value ||
                                                  task.dueTime,
                                              });
                                            }}
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEditingTask(null)}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <p
                                          className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}
                                        >
                                          {task.title}
                                        </p>
                                        {task.assignedTo && (
                                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <UserPlus className="h-3 w-3" />
                                            {task.assignedTo}
                                          </p>
                                        )}
                                        {task.dueDate && (
                                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(
                                              task.dueDate,
                                            ).toLocaleDateString()}
                                            {task.dueTime &&
                                              ` at ${task.dueTime}`}
                                          </p>
                                        )}
                                        {task.completed && task.completedAt && (
                                          <p className="text-xs text-green-600 flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3" />
                                            Completed by {
                                              task.completedBy
                                            } on{" "}
                                            {formatTimestamp(task.completedAt)}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {editingTask !== task.id && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => setEditingTask(task.id)}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => deleteTask(task.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No tasks assigned yet</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Checklists</CardTitle>
                        <Button
                          onClick={() => setShowAddChecklist(true)}
                          size="sm"
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Item
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {showAddChecklist && (
                          <div className="border rounded-lg p-4 mb-4 space-y-3">
                            <Input
                              placeholder="Checklist item"
                              value={newChecklistItem}
                              onChange={(e) =>
                                setNewChecklistItem(e.target.value)
                              }
                            />
                            <div className="flex gap-2">
                              <Button onClick={addChecklistItem} size="sm">
                                Add Item
                              </Button>
                              <Button
                                onClick={() => setShowAddChecklist(false)}
                                variant="outline"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          {project.checklist &&
                          Array.isArray(project.checklist) &&
                          project.checklist.length > 0 ? (
                            project.checklist.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start justify-between p-2 border rounded-lg"
                              >
                                <div className="flex items-start gap-3 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={!!item.completed}
                                    onChange={() =>
                                      toggleChecklistItem(item.id)
                                    }
                                    className="rounded mt-1"
                                  />
                                  <div className="flex-1">
                                    {editingChecklistItem === item.id ? (
                                      <div className="space-y-2">
                                        <Input
                                          defaultValue={item.title}
                                          placeholder="Checklist item"
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={(e) => {
                                              const input = e.currentTarget
                                                .parentElement
                                                ?.previousElementSibling as HTMLInputElement;
                                              editChecklistItem(
                                                item.id,
                                                input.value,
                                              );
                                            }}
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              setEditingChecklistItem(null)
                                            }
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <span
                                          className={
                                            item.completed
                                              ? "line-through text-muted-foreground"
                                              : ""
                                          }
                                        >
                                          {item.title}
                                        </span>
                                        {item.completed && item.completedAt && (
                                          <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                            <CheckCircle className="h-3 w-3" />
                                            Completed by {
                                              item.completedBy
                                            } on{" "}
                                            {formatTimestamp(item.completedAt)}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {editingChecklistItem !== item.id && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setEditingChecklistItem(item.id)
                                        }
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          deleteChecklistItem(item.id)
                                        }
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No checklist items yet</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Documents Tab */}
                {activeTab === "documents" && (
                  <Card key="documents-tab-content">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Project Documents
                      </CardTitle>
                      <Button
                        onClick={() => documentInputRef.current?.click()}
                        size="sm"
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Upload Document
                      </Button>
                      <input
                        ref={documentInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip,.xls,.xlsx"
                        className="hidden"
                        onChange={(e) => handleDocumentUpload(e.target.files)}
                      />
                    </CardHeader>
                    <CardContent>
                      {project.documents && project.documents.length > 0 ? (
                        <div className="space-y-3">
                          {project.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                                <div>
                                  {renamingDocId === doc.id ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        autoFocus
                                        type="text"
                                        value={renameDocValue}
                                        onChange={(e) => setRenameDocValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveRenameDoc();
                                          if (e.key === "Escape") cancelRenameDoc();
                                        }}
                                        className="text-sm border rounded px-2 py-0.5 w-48 focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                      <button
                                        onClick={saveRenameDoc}
                                        className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={cancelRenameDoc}
                                        className="text-xs px-2 py-0.5 rounded hover:bg-muted"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="font-medium">{doc.name}</p>
                                  )}
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground" style={{ display: renamingDocId === doc.id ? 'none' : undefined }}>
                                    <span>
                                      Uploaded on{" "}
                                      {new Date(
                                        doc.uploadedAt,
                                      ).toLocaleDateString()}
                                    </span>
                                    <span>���</span>
                                    <span>by {doc.uploadedBy}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(doc.url, "_blank")}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const a = document.createElement("a");
                                    a.href = doc.url;
                                    a.download = doc.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    toast.success("Document downloaded");
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => startRenameDoc(doc)}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => deleteDocument(doc.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No documents uploaded yet</p>
                          <p className="text-sm mt-1">
                            Upload project documents, contracts, or files
                          </p>
                          <Button
                            variant="outline"
                            className="mt-4 gap-2"
                            onClick={() =>
                              toast.success(
                                "Upload document functionality coming soon",
                              )
                            }
                          >
                            <Plus className="h-4 w-4" />
                            Upload First Document
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Activity Log Tab */}
                {activeTab === "activity" && (
                  <Card key="activity-tab-content">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Activity Log</CardTitle>
                      <div className="flex items-center gap-2">
                        <Select defaultValue="10">
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">
                          rows
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {project.activityLog && project.activityLog.length > 0 ? (
                        <div className="space-y-4">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-2 font-medium cursor-pointer hover:bg-muted">
                                    Platform
                                  </th>
                                  <th className="text-left p-2 font-medium cursor-pointer hover:bg-muted">
                                    Action
                                  </th>
                                  <th className="text-left p-2 font-medium cursor-pointer hover:bg-muted">
                                    User
                                  </th>
                                  <th className="text-left p-2 font-medium cursor-pointer hover:bg-muted">
                                    Date/Time
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {project.activityLog
                                  .slice(0, 10)
                                  .map((entry) => (
                                    <tr
                                      key={entry.id}
                                      className="border-b hover:bg-muted/50"
                                    >
                                      <td className="p-2">
                                        <div className="flex items-center gap-2">
                                          <span>
                                            {entry.platform === "mobile" ? (
                                              <Smartphone className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                              <Monitor className="h-4 w-4 text-muted-foreground" />
                                            )}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className="text-xs capitalize"
                                          >
                                            {entry.platform}
                                          </Badge>
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <span className="font-medium text-sm">
                                          {entry.description}
                                        </span>
                                      </td>
                                      <td className="p-2">
                                        <span className="text-sm text-muted-foreground">
                                          {entry.userName}
                                        </span>
                                      </td>
                                      <td className="p-2">
                                        <span className="text-sm text-muted-foreground">
                                          {formatTimestamp(entry.timestamp)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>

                          {project.activityLog.length > 10 && (
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>
                                <span key="pagination-text">
                                  Showing 1-10 of {project.activityLog.length}{" "}
                                  entries
                                </span>
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  key="pagination-prev"
                                  variant="outline"
                                  size="sm"
                                >
                                  Previous
                                </Button>
                                <Button
                                  key="pagination-next"
                                  variant="outline"
                                  size="sm"
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No activity logged yet</p>
                          <p className="text-sm mt-1">
                            Activity will appear here as you work on the project
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6" key="sidebar-content">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Created
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <Separator />

                    {(project.customerName ||
                      project.mobilePhone ||
                      project.customerPhone ||
                      (project.additionalPhones &&
                        project.additionalPhones.length > 0)) && (
                      <div>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Customer Information
                          </h4>

                          {project.customerName && (
                            <div className="mb-2">
                              <p className="text-xs text-muted-foreground">
                                Name
                              </p>
                              <p className="text-sm font-medium">
                                {project.customerName}
                              </p>
                            </div>
                          )}

                          {(project.mobilePhone || project.customerPhone) && (
                            <div className="mb-2">
                              <p className="text-xs text-muted-foreground">
                                Mobile Phone
                              </p>
                              <a
                                href={`tel:${project.mobilePhone || project.customerPhone}`}
                                className="text-sm text-primary hover:underline"
                              >
                                {project.mobilePhone || project.customerPhone}
                              </a>
                            </div>
                          )}

                          {project.additionalPhones &&
                            project.additionalPhones.filter((phone) =>
                              phone.trim(),
                            ).length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-muted-foreground">
                                  Additional Numbers
                                </p>
                                {project.additionalPhones
                                  .filter((phone) => phone.trim())
                                  .map((phone, index) => (
                                    <a
                                      key={`additional-phone-${index}-${phone.replace(/\D/g, "")}`}
                                      href={`tel:${phone}`}
                                      className="text-sm text-primary hover:underline block"
                                    >
                                      {phone}
                                    </a>
                                  ))}
                              </div>
                            )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 w-full"
                            onClick={requestGoogleReview}
                            disabled={
                              !project.mobilePhone && !project.customerPhone
                            }
                          >
                            <Star className="h-4 w-4" />
                            Request Google Review
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Images className="h-3 w-3" />
                        Photos
                      </span>
                      <span className="font-medium">
                        {project.photos.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        Videos
                      </span>
                      <span className="font-medium">
                        {project.videos?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Documents
                      </span>
                      <span className="font-medium">
                        {project.documents?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Notes
                      </span>
                      <span className="font-medium">
                        {project.notes?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Tasks
                      </span>
                      <span className="font-medium">
                        {project.tasks?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Checklist Items
                      </span>
                      <span className="font-medium">
                        {project.checklist?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        Media Storage
                      </span>
                      <span className="font-medium">
                        {(() => {
                          // Calculate total media storage size from actual file sizes
                          let totalBytes = 0;
                          if (project.photos && Array.isArray(project.photos)) {
                            project.photos.forEach((photo: any) => {
                              // Handle both string URLs and object formats
                              if (typeof photo === "object" && photo.file_size) {
                                totalBytes += photo.file_size;
                              }
                            });
                          }
                          const totalMB = totalBytes / (1024 * 1024);
                          return totalMB.toFixed(2);
                        })()}{" "}
                        MB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Keywords
                      </span>
                      <span className="font-medium">
                        {project.keywords.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Project Age
                      </span>
                      <span className="font-medium">
                        {Math.ceil(
                          (Date.now() - new Date(project.createdAt).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )}{" "}
                        days
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Media Modal */}
        {selectedPhoto && (
          <div
            key="media-modal"
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200]"
            onClick={() => setSelectedPhoto(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setSelectedPhoto(null)}
            >
              ×
            </Button>
            <div
              className="relative w-full h-full flex items-center justify-center p-10"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const selectedMediaObj = project?.photos.find(
                  (p) => getPhotoUrl(p) === selectedPhoto
                );
                const isVideo =
                  typeof selectedMediaObj === "object" &&
                  selectedMediaObj?.media_type === "video";

                return isVideo ? (
                  <video
                    src={selectedPhoto}
                    controls
                    autoPlay
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ maxHeight: "calc(100vh - 80px)" }}
                  />
                ) : (
                  <img
                    src={selectedPhoto}
                    alt="Full size photo"
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ maxHeight: "calc(100vh - 80px)" }}
                  />
                );
              })()}
            </div>
          </div>
        )}

        {/* Project ID Display - Bottom Right */}
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-muted/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Project ID:</span>
              <code className="font-mono text-foreground font-medium">
                {project?.id}
              </code>
            </div>
          </div>
        </div>

        {/* Review Request Dialog */}
        <ReviewRequest
          key="review-request-dialog"
          isOpen={showReviewRequest}
          onClose={() => setShowReviewRequest(false)}
          customerName={project?.customerName}
          customerEmail={project?.customerEmail}
          customerPhone={project?.mobilePhone || project?.customerPhone}
          projectName={project?.name || ""}
          onSend={handleSendReviewRequest}
        />

        {/* Smart Media Uploader */}
        {showMediaUploader && (
          <div
            key="media-uploader-modal"
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add Photos & Videos</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMediaUploader(false)}
                >
                  ��
                </Button>
              </div>
              <SmartMediaUploader
                onFilesReady={handleMediaFilesReady}
                projectInfo={{
                  name: project?.name || "",
                  keywords: project?.keywords || [],
                  address: project?.address,
                  customerName: project?.customerName,
                }}
                maxFiles={20}
                maxFileSize={100}
              />
            </div>
          </div>
        )}
      </React.Fragment>
    </AppLayout>
  );
}

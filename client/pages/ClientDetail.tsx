import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Images,
  Video,
  Star,
  FolderOpen,
  Edit,
  Save,
  X,
  Plus,
  ExternalLink,
  Trash2,
  MessageSquare,
  Upload,
  FilePlus,
  File,
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase, dataService } from "@/lib/dataService";
import { SmartMediaUploader } from "@/components/SmartMediaUploader";
import { workspaceService } from "@/lib/workspaceService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Client {
  id: string;
  name: string;
  business_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  type: string;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  text: string;
  author: any;
  platform: string;
  date: string;
}

interface MediaItem {
  id: string;
  file_path: string;
  original_name: string;
  media_type: string;
  created_at: string;
}

interface Document {
  id: string;
  original_name: string;
  file_path: string;
  document_type: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  active: "default",
  in_progress: "default",
  paused: "secondary",
  completed: "outline",
  cancelled: "destructive",
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValue, setFieldValue] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showNewJobDialog, setShowNewJobDialog] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [newJobType, setNewJobType] = useState("residential");
  const [creatingJob, setCreatingJob] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedJobForUpload, setSelectedJobForUpload] = useState<string>("");
  const [showDocUploader, setShowDocUploader] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docJobForUpload, setDocJobForUpload] = useState<string>("none");
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [docCustomName, setDocCustomName] = useState("");
  const [docType, setDocType] = useState("general");
  const [docDescription, setDocDescription] = useState("");

  const loadClient = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setClient(data);

      // Load linked projects
      const { data: projectData } = await supabase
        .from("jobs")
        .select("id, name, status, type, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      setProjects(projectData || []);

      // Load media across all linked projects
      if (projectData && projectData.length > 0) {
        const projectIds = projectData.map((p: any) => p.id);

        const { data: mediaData } = await supabase
          .from("project_media")
          .select("id, file_path, original_name, media_type, created_at")
          .in("project_id", projectIds)
          .eq("media_type", "image")
          .order("created_at", { ascending: false })
          .limit(50);
        setMedia(mediaData || []);

        const { data: videoData } = await supabase
          .from("project_media")
          .select("id, file_path, original_name, media_type, created_at")
          .in("project_id", projectIds)
          .eq("media_type", "video")
          .order("created_at", { ascending: false })
          .limit(50);
        setVideos(videoData || []);

        const { data: jobDocData } = await supabase
          .from("project_documents")
          .select("id, original_name, file_path, document_type, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false });

        // Also load documents uploaded directly to the client (no job)
        const { data: clientDocData } = await supabase
          .from("project_documents")
          .select("id, original_name, file_path, document_type, created_at")
          .eq("client_id", id)
          .is("project_id", null)
          .order("created_at", { ascending: false });

        setDocuments([...(clientDocData || []), ...(jobDocData || [])]);
      } else {
        // No jobs — still load client-level documents
        const { data: clientDocData } = await supabase
          .from("project_documents")
          .select("id, original_name, file_path, document_type, created_at")
          .eq("client_id", id)
          .is("project_id", null)
          .order("created_at", { ascending: false });
        setDocuments(clientDocData || []);
      }

      // Load reviews by client email match
      if (data?.email) {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("id, rating, text, author, platform, date")
          .order("date", { ascending: false })
          .limit(20);
        setReviews(reviewData || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load client");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClient();
  }, [id]);

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setFieldValue(value);
  };

  const saveField = async () => {
    if (!client || !editingField) return;
    try {
      const { error } = await supabase
        .from("clients")
        .update({ [editingField]: fieldValue.trim(), updated_at: new Date().toISOString() })
        .eq("id", client.id);
      if (error) throw error;
      setClient({ ...client, [editingField]: fieldValue.trim() });
      setEditingField(null);
      toast.success("Saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save");
    }
  };

  const cancelEdit = () => setEditingField(null);

  const getOrCreateDefaultJob = async (): Promise<string> => {
    // Use existing selected/first job if available
    const existing = selectedJobForUpload || projects[0]?.id;
    if (existing) return existing;
    // No jobs — auto-create a default "Client Media" job for this client
    const businessId = workspaceService.getCurrentBusinessId();
    const job = await dataService.createProject({
      name: `${client?.name || "Client"} — General Media`,
      type: "other",
      status: "active",
      business_id: businessId || undefined,
      client_id: id,
    } as any);
    // Refresh the projects list so the new job shows up
    setProjects((prev) => [job as any, ...prev]);
    return job.id;
  };

  const handleMediaFilesReady = async (files: any[]) => {
    if (!files.length) return;
    setUploadingMedia(true);
    let uploaded = 0;
    try {
      const jobId = await getOrCreateDefaultJob();
      for (const fileData of files) {
        try {
          const actualFile = fileData.file || fileData;
          const tagsArray =
            typeof fileData.tags === "string"
              ? fileData.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
              : fileData.tags || [];
          const VALID_MEDIA_CATEGORIES = ["before", "after", "progress", "final", "reference", "general", "walkthrough", "demonstration"];
          const safeCategory = VALID_MEDIA_CATEGORIES.includes(fileData.category) ? fileData.category : "general";
          await dataService.uploadProjectPhoto(jobId, actualFile, {
            tags: tagsArray,
            category: safeCategory,
            description: fileData.description || "",
            is_featured: false,
          });
          uploaded++;
        } catch (err) {
          console.error("Upload error:", err);
          toast.error(`Failed to upload ${fileData.original_name || fileData.fileName || "file"}`);
        }
      }
      if (uploaded > 0) {
        toast.success(`Uploaded ${uploaded} file${uploaded !== 1 ? "s" : ""}`);
        setShowMediaUploader(false);
        loadClient();
      }
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDocUpload = async () => {
    if (!docFiles.length) {
      toast.error("Please select at least one file");
      return;
    }
    setUploadingDoc(true);
    let uploaded = 0;
    try {
      for (let i = 0; i < docFiles.length; i++) {
        const file = docFiles[i];
        const customName = docFiles.length === 1 ? (docCustomName.trim() || file.name) : file.name;
        const uploadMeta = { document_type: docType, description: docDescription, custom_name: customName };
        try {
          if (docJobForUpload && docJobForUpload !== "none") {
            // Upload attached to a specific job
            await dataService.uploadProjectDocument(docJobForUpload, file, uploadMeta);
          } else {
            // Upload directly to the client — no job created
            await dataService.uploadClientDocument(id!, file, uploadMeta);
          }
          uploaded++;
        } catch (err: any) {
          console.error("Doc upload error:", err);
          toast.error(`Failed to upload ${file.name}: ${err?.message || "Unknown error"}`);
        }
      }
      if (uploaded > 0) {
        toast.success(`Uploaded ${uploaded} document${uploaded !== 1 ? "s" : ""}`);
        setShowDocUploader(false);
        setDocFiles([]);
        setDocCustomName("");
        loadClient();
      }
    } catch (err: any) {
      console.error("Doc upload outer error:", err);
      toast.error(`Upload failed: ${err?.message || "Unknown error"}`);
    } finally {
      setUploadingDoc(false);
    }
  };

  const createJob = async () => {
    if (!newJobName.trim()) {
      toast.error("Job name is required");
      return;
    }
    setCreatingJob(true);
    try {
      const businessId = workspaceService.getCurrentBusinessId();
      const job = await dataService.createProject({
        name: newJobName.trim(),
        type: newJobType,
        status: "draft",
        business_id: businessId || undefined,
        client_id: id,
      } as any);
      toast.success("Job created and assigned to this client");
      setShowNewJobDialog(false);
      setNewJobName("");
      navigate(`/job/${job.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create job");
    } finally {
      setCreatingJob(false);
    }
  };

  const getSupabaseUrl = (path: string) => {
    const base = import.meta.env.VITE_SUPABASE_URL;
    return `${base}/storage/v1/object/public/media/${path}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="p-6 text-center py-16">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground">Client not found</p>
          <Button onClick={() => navigate("/admin/clients")} className="mt-4" variant="outline">
            Back to Clients
          </Button>
        </div>
      </AppLayout>
    );
  }

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const InlineField = ({
    field,
    label,
    value,
    icon: Icon,
    multiline = false,
    placeholder,
  }: {
    field: string;
    label: string;
    value?: string;
    icon: any;
    multiline?: boolean;
    placeholder?: string;
  }) => {
    const isEditing = editingField === field;
    return (
      <div className="flex items-start gap-3 group">
        {/* Fixed-width label on the left */}
        <span className="text-sm text-muted-foreground w-28 flex-shrink-0 pt-1.5">{label}</span>
        {/* Field */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-start gap-2">
              {multiline ? (
                <Textarea
                  autoFocus
                  rows={3}
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                  className="text-sm"
                />
              ) : (
                <Input
                  autoFocus
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveField();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="text-sm h-8"
                />
              )}
              <Button size="sm" className="h-8 px-2" onClick={saveField}>
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={cancelEdit}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer group/field"
              onClick={() => startEdit(field, value || "")}
            >
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className={`text-sm ${value ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
                {value || placeholder || `Add ${label.toLowerCase()}`}
              </span>
              <Edit className="h-3 w-3 text-muted-foreground opacity-0 group-hover/field:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/clients")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base flex-shrink-0">
              {initials(client.name)}
            </div>
            <div className="min-w-0 flex-1">
              {editingField === "name" ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveField();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="text-xl font-bold h-9"
                  />
                  <Button size="sm" onClick={saveField}><Save className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 cursor-pointer group/name"
                  onClick={() => startEdit("name", client.name)}
                >
                  <h1 className="text-xl font-bold truncate">{client.name}</h1>
                  <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Client since {new Date(client.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview" className="gap-1.5">
              <User className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1.5">
              <FolderOpen className="h-4 w-4" />
              Jobs
              {projects.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{projects.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5">
              <Images className="h-4 w-4" />
              Media
              {(media.length + videos.length) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{media.length + videos.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Docs
              {documents.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{documents.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5">
              <Star className="h-4 w-4" />
              Reviews
              {reviews.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{reviews.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InlineField field="business_name" label="Business Name" value={client.business_name} icon={Building2} placeholder="Add business name" />
                <div className="flex gap-2">
                  <div className="w-1/3">
                    <InlineField field="first_name" label="First Name" value={client.first_name} icon={User} placeholder="First name" />
                  </div>
                  <div className="w-1/3">
                    <InlineField field="last_name" label="Last Name" value={client.last_name} icon={User} placeholder="Last name" />
                  </div>
                </div>
                <InlineField field="phone" label="Phone" value={client.phone} icon={Phone} placeholder="Add phone number" />
                <InlineField field="email" label="Email" value={client.email} icon={Mail} placeholder="Add email address" />
                <InlineField field="address" label="Address" value={client.address} icon={MapPin} placeholder="Add address" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InlineField
                  field="notes"
                  label=""
                  value={client.notes}
                  icon={MessageSquare}
                  multiline
                  placeholder="Add notes about this client..."
                />
              </CardContent>
            </Card>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Jobs", value: projects.length, icon: FolderOpen },
                { label: "Photos", value: media.length, icon: Images },
                { label: "Documents", value: documents.length, icon: FileText },
                { label: "Reviews", value: reviews.length, icon: Star },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="p-4 text-center">
                    <Icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Jobs */}
          <TabsContent value="jobs" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Jobs / Projects</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowNewJobDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  New Job
                </Button>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No jobs linked to this client yet</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 gap-2"
                      onClick={() => setShowNewJobDialog(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Create first job
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/job/${project.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{project.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {project.type?.replace(/_/g, " ")} •{" "}
                            {new Date(project.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={(STATUS_COLORS[project.status] || "secondary") as any} className="text-xs capitalize">
                            {project.status?.replace(/_/g, " ")}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Media */}
          <TabsContent value="media" className="mt-4 space-y-4">
            {/* Upload button row */}
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setSelectedJobForUpload(projects[0]?.id || "");
                  setShowMediaUploader(true);
                }}
                className="gap-2"
                size="sm"
              >
                <Upload className="h-4 w-4" />
                Add Media
              </Button>
            </div>

            {/* Photos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Images className="h-4 w-4" />
                  Photos
                  {media.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{media.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {media.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Images className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No photos across linked jobs</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {media.map((item) => {
                      const url = getSupabaseUrl(item.file_path);
                      return (
                        <div
                          key={item.id}
                          className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedPhoto(url)}
                        >
                          <img
                            src={url}
                            alt={item.original_name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Videos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Videos
                  {videos.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{videos.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {videos.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Video className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No videos across linked jobs</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {videos.map((item) => {
                      const url = getSupabaseUrl(item.file_path);
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg overflow-hidden bg-muted aspect-video"
                        >
                          <video
                            src={url}
                            controls
                            className="h-full w-full object-cover"
                            preload="metadata"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents
                  {documents.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{documents.length}</Badge>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setDocJobForUpload("none");
                    setDocFiles([]);
                    setDocCustomName("");
                    setDocType("general");
                    setDocDescription("");
                    setShowDocUploader(true);
                  }}
                >
                  <FilePlus className="h-4 w-4" />
                  Upload Document
                </Button>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No documents across linked jobs</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.original_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {doc.document_type?.replace(/_/g, " ")} •{" "}
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <a
                          href={doc.file_path.startsWith("http") ? doc.file_path : getSupabaseUrl(doc.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews */}
          <TabsContent value="reviews" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Star className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No reviews found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <div key={review.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                            <Badge variant="outline" className="text-xs capitalize">
                              {review.platform}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {review.date
                              ? new Date(review.date).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                        {review.author?.name && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {review.author.name}
                          </p>
                        )}
                        <p className="text-sm text-foreground">{review.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Job Dialog */}
      <Dialog open={showNewJobDialog} onOpenChange={setShowNewJobDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Job for {client?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Job Name *</Label>
              <Input
                autoFocus
                placeholder="e.g. Roof replacement, Kitchen remodel…"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createJob();
                  if (e.key === "Escape") setShowNewJobDialog(false);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Job Type</Label>
              <Select value={newJobType} onValueChange={setNewJobType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              This job will be automatically assigned to{" "}
              <span className="font-medium">{client?.name}</span>. You can fill
              in the full details after creation.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewJobDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={createJob} disabled={creatingJob || !newJobName.trim()}>
              {creatingJob ? "Creating…" : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Uploader Dialog */}
      <Dialog open={showMediaUploader} onOpenChange={setShowMediaUploader}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Add Photos &amp; Videos
            </DialogTitle>
          </DialogHeader>

          {/* Job selector */}
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground pb-2 border-b">
              This client has no jobs yet. A <span className="font-medium">General Media</span> job will be created automatically to store uploaded files.
            </p>
          ) : projects.length > 1 ? (
            <div className="space-y-1 pb-2 border-b">
              <Label className="text-sm">Attach to job</Label>
              <Select
                value={selectedJobForUpload}
                onValueChange={setSelectedJobForUpload}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Media will be stored under the selected job
              </p>
            </div>
          ) : null}

          {uploadingMedia ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Uploading files…</p>
            </div>
          ) : (
            <SmartMediaUploader
              onFilesReady={handleMediaFilesReady}
              projectInfo={{
                name: client?.name || "",
                keywords: [],
                customerName: client?.name,
                address: client?.address,
              }}
              maxFiles={20}
              maxFileSize={100}
              context={{ type: "project", isPublic: true }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={showDocUploader} onOpenChange={setShowDocUploader}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus className="h-5 w-5" />
              Upload Documents
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Job selector — always visible, optional */}
            <div className="space-y-1">
              <Label>Associated Job <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={docJobForUpload} onValueChange={setDocJobForUpload}>
                <SelectTrigger>
                  <SelectValue placeholder="No specific job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific job</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {docJobForUpload === "none" && (
                <p className="text-xs text-muted-foreground">Will be stored directly on this client profile.</p>
              )}
            </div>

            {/* File picker */}
            <div className="space-y-1">
              <Label>File *</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => document.getElementById("doc-file-input")?.click()}
              >
                <input
                  id="doc-file-input"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setDocFiles(files);
                    // Pre-fill custom name with first file's name
                    if (files.length === 1) setDocCustomName(files[0].name);
                    else setDocCustomName("");
                  }}
                />
                {docFiles.length > 0 ? (
                  <div className="space-y-1">
                    {docFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm justify-center">
                        <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate max-w-[280px]">{f.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">
                          ({(f.size / 1024 / 1024).toFixed(1)} MB)
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">Click to change files</p>
                  </div>
                ) : (
                  <>
                    <FilePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm font-medium">Click to select files</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word, Excel, CSV, PowerPoint, images, ZIP
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Custom name — only shown for single file */}
            {docFiles.length === 1 && (
              <div className="space-y-1">
                <Label>Save as</Label>
                <Input
                  placeholder="Document name"
                  value={docCustomName}
                  onChange={(e) => setDocCustomName(e.target.value)}
                />
              </div>
            )}

            {/* Document type */}
            <div className="space-y-1">
              <Label>Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="correspondence">Correspondence</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="Brief description of this document…"
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocUploader(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDocUpload}
              disabled={uploadingDoc || docFiles.length === 0}
              className="gap-2"
            >
              {uploadingDoc ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {docFiles.length > 0 ? `${docFiles.length} file${docFiles.length !== 1 ? "s" : ""}` : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200]"
          onClick={() => setSelectedPhoto(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="w-full h-full flex items-center justify-center p-10" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedPhoto}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ maxHeight: "calc(100vh - 80px)" }}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

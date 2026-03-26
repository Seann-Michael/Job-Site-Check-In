import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Images, MapPin, CalendarDays, Tag } from "lucide-react";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import supabaseClient from "@/lib/supabaseClient";

interface TaggedPhoto {
  url: string;
  tags: string[];
  uploadedAt: string;
  uploadedBy: string;
  isPrimary?: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string;
  photos: TaggedPhoto[] | string[];
  keywords: string[];
  createdAt: string;
}

export default function PublicProject() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const loadProject = async () => {
      try {
        const { data, error } = await supabaseClient
          .from("jobs")
          .select("id, name, description, photos, keywords, created_at, media")
          .eq("id", id)
          .single();

        if (!error && data) {
          setProject({
            id: data.id,
            name: data.name,
            description: data.description ?? "",
            photos: data.photos ?? data.media ?? [],
            keywords: data.keywords ?? [],
            createdAt: data.created_at,
          });
        }
      } catch {
        // Project not found — show "not found" state
      }
    };
    loadProject();
  }, [id]);

  const getPhotoUrl = (photo: TaggedPhoto | string): string => {
    return typeof photo === "string" ? photo : photo.url;
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Project not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
          <p className="text-muted-foreground">
            Completed on {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Project Description */}
          {project.description && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-lg leading-relaxed">{project.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Photo Gallery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Images className="h-5 w-5" />
                Project Gallery ({project.photos.length} photos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.photos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {project.photos.map((photo, index) => {
                    const photoUrl = getPhotoUrl(photo);
                    return (
                      <div
                        key={index}
                        className="aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedPhoto(photoUrl)}
                      >
                        <img
                          src={photoUrl}
                          alt={`Project photo ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Images className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No photos available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>
                  Completed: {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>

              {project.keywords.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4" />
                    <span className="font-medium">Keywords</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {project.keywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Photo Modal */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="relative max-w-4xl max-h-full">
              <img
                src={selectedPhoto}
                alt="Full size photo"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <button
                className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/75"
                onClick={() => setSelectedPhoto(null)}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            Powered by ProjectLens
          </p>
        </div>
      </div>
    </div>
  );
}

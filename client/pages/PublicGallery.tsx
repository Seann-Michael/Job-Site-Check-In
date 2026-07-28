import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Images, CalendarDays } from "lucide-react";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import supabaseClient from "@/lib/supabaseClient";

interface SharedGallery {
  token: string;
  jobTitle: string;
  businessName: string;
  photoUrls: string[];
  createdAt: string;
}

/**
 * Public client gallery — opened from the share links the mobile app
 * creates (Share gallery on a job). No login required.
 */
export default function PublicGallery() {
  const { token } = useParams();
  const [gallery, setGallery] = useState<SharedGallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const loadGallery = async () => {
      try {
        // Token-argument RPC, NOT a table select.
        //
        // supabase/migrations/…w0_10… closes anon SELECT on shared_galleries.
        // A `FOR SELECT TO anon` policy could not require the .eq("token", …)
        // filter — PostgREST happily serves a bare select — so the anon key
        // that ships in the app bundle could list every gallery of every
        // tenant. A function argument cannot be omitted.
        const { data: rows, error } = await supabaseClient.rpc(
          "gallery_by_token",
          { p_token: token },
        );
        const data = Array.isArray(rows) ? rows[0] : rows;

        if (!error && data) {
          setGallery({
            token: data.token,
            jobTitle: data.job_title ?? "Project photos",
            businessName: data.business_name ?? "",
            photoUrls: Array.isArray(data.photo_urls) ? data.photo_urls : [],
            createdAt: data.created_at,
          });
        }
      } catch {
        // Not found — falls through to the empty state
      } finally {
        setLoading(false);
      }
    };
    loadGallery();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading gallery…</p>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <Images className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              This gallery link is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-8 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          {gallery.businessName ? (
            <Badge variant="secondary" className="mb-3">
              {gallery.businessName}
            </Badge>
          ) : null}
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {gallery.jobTitle}
          </h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4" />
            Shared {new Date(gallery.createdAt).toLocaleDateString()}
            <span>·</span>
            <Images className="h-4 w-4" />
            {gallery.photoUrls.length} photos
          </p>
        </div>

        {gallery.photoUrls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No photos in this gallery yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.photoUrls.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => setSelectedPhoto(url)}
                className="aspect-square overflow-hidden rounded-lg border bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <img
                  src={url}
                  alt={`${gallery.jobTitle} photo ${index + 1}`}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPhoto ? (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <img
            src={selectedPhoto}
            alt={gallery.jobTitle}
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        </div>
      ) : null}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Globe,
  Star,
  Edit3,
  Plus,
  Trash2,
  RefreshCw,
  Wand2,
  Building2,
  MessageSquare,
  Image as ImageIcon,
  AlertCircle,
  Settings,
  Save,
  X,
  Link2,
  Unlink,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { aiApi, aiErrorMessage } from "@/lib/api";
import { supabase } from "@/lib/dataService";
import { workspaceService } from "@/lib/workspaceService";
import { loadGoogleMapsAPI } from "@/lib/googleMaps";
import { BusinessPlacesSearch } from "@/components/GoogleMaps/BusinessPlacesSearch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GMBProfile {
  id: string;
  business_id: string;
  place_id: string;
  business_name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number;
  types: string[] | null;
  description: string | null;
  overall_score: number;
  photos: string[] | null;
  lat: number | null;
  lng: number | null;
  google_url: string | null;
  last_scanned_at: string | null;
}

interface GMBHour {
  id?: string;
  business_id: string;
  day: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface GMBQA {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  author: string;
  source: string;
  created_at: string;
}

interface GMBCategory {
  id: string;
  business_id: string;
  name: string;
  is_primary: boolean;
}

interface GMBService {
  id: string;
  business_id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  image_url: string;
}

interface AuditResult {
  id: string;
  category: string;
  title: string;
  description: string;
  status: "critical" | "warning" | "good";
  impact: "high" | "medium" | "low";
  action_required: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreLabel(score: number) {
  if (score >= 80) return { label: "Excellent", color: "text-green-600" };
  if (score >= 60) return { label: "Good", color: "text-yellow-600" };
  if (score >= 40) return { label: "Needs Work", color: "text-orange-600" };
  return { label: "Critical", color: "text-red-600" };
}

/** Generate audit items from a Google Places detail result */
function generateAuditFromPlace(place: any): Omit<AuditResult, "id">[] {
  const items: Omit<AuditResult, "id">[] = [];

  if (!place.formatted_phone_number) {
    items.push({ category: "Contact", title: "Missing Phone Number", description: "No phone number is listed on your GMB profile.", status: "critical", impact: "high", action_required: "Add a phone number to your GMB profile." });
  } else {
    items.push({ category: "Contact", title: "Phone Number Present", description: "Your phone number is listed correctly.", status: "good", impact: "low", action_required: "No action needed." });
  }

  if (!place.website) {
    items.push({ category: "Online Presence", title: "No Website Linked", description: "Your profile has no website link, reducing customer trust.", status: "critical", impact: "high", action_required: "Add your website URL to your GMB profile." });
  } else {
    items.push({ category: "Online Presence", title: "Website Linked", description: "Your website is linked to your GMB profile.", status: "good", impact: "low", action_required: "No action needed." });
  }

  const photoCount = (place.photos || []).length;
  if (photoCount < 5) {
    items.push({ category: "Photos", title: "Insufficient Photos", description: `You have ${photoCount} photo(s). Businesses with 10+ photos get 42% more direction requests.`, status: "warning", impact: "medium", action_required: "Upload at least 10 high-quality photos." });
  } else {
    items.push({ category: "Photos", title: "Good Photo Coverage", description: `You have ${photoCount} photos — keep adding seasonal and interior shots.`, status: "good", impact: "low", action_required: "Continue adding fresh photos regularly." });
  }

  const rating = place.rating || 0;
  const reviewCount = place.user_ratings_total || 0;
  if (rating < 4.0) {
    items.push({ category: "Reviews", title: "Below-Average Rating", description: `Your rating is ${rating.toFixed(1)} ⭐. Aim for 4.0+.`, status: "critical", impact: "high", action_required: "Respond to negative reviews and actively request positive reviews." });
  } else if (reviewCount < 20) {
    items.push({ category: "Reviews", title: "Low Review Count", description: `You have ${reviewCount} review(s). More reviews improve trust and local ranking.`, status: "warning", impact: "medium", action_required: "Send review request links to recent customers." });
  } else {
    items.push({ category: "Reviews", title: "Strong Review Profile", description: `${rating.toFixed(1)} ⭐ across ${reviewCount} reviews. Keep engaging!`, status: "good", impact: "low", action_required: "Continue responding to all reviews." });
  }

  if (!place.opening_hours) {
    items.push({ category: "Business Hours", title: "Hours Not Set", description: "Your business hours are missing, causing customer confusion.", status: "critical", impact: "high", action_required: "Add your business hours in the Hours tab." });
  } else {
    items.push({ category: "Business Hours", title: "Hours Configured", description: "Business hours are set on your profile.", status: "good", impact: "low", action_required: "Keep hours updated for holidays." });
  }

  return items;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GMBOptimization() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [profile, setProfile] = useState<GMBProfile | null>(null);
  const [hours, setHours] = useState<GMBHour[]>([]);
  const [qas, setQAs] = useState<GMBQA[]>([]);
  const [categories, setCategories] = useState<GMBCategory[]>([]);
  const [services, setServices] = useState<GMBService[]>([]);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  const [selectedTab, setSelectedTab] = useState("audit");

  // Connection form state
  const [showConnectFlow, setShowConnectFlow] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);

  // Q&A form
  const [newQA, setNewQA] = useState({ question: "", answer: "" });
  const [addingQA, setAddingQA] = useState(false);

  // Service form
  const [newService, setNewService] = useState({ name: "", description: "", price: "", category: "", image_url: "" });
  const [addingService, setAddingService] = useState(false);

  // Category form
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // ── Bootstrap: get current business ────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      let state = workspaceService.getState();
      if (!state.initialized) state = await workspaceService.initialize();
      const bid = state.currentBusinessId;
      setBusinessId(bid);
      if (bid) await loadProfile(bid);
      else setLoading(false);
    };
    init();
  }, []);

  // ── Data loaders ────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (bid: string) => {
    setLoading(true);
    try {
      const [profRes, hoursRes, qaRes, catRes, svcRes, auditRes] = await Promise.all([
        supabase.from("gmb_profiles").select("*").eq("business_id", bid).maybeSingle(),
        supabase.from("gmb_hours").select("*").eq("business_id", bid).order("id"),
        supabase.from("gmb_qas").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("gmb_categories").select("*").eq("business_id", bid).order("is_primary", { ascending: false }),
        supabase.from("gmb_services").select("*").eq("business_id", bid).order("created_at"),
        supabase.from("gmb_audit_results").select("*").eq("business_id", bid).order("scanned_at", { ascending: false }).limit(20),
      ]);

      if (profRes.data) setProfile(profRes.data as unknown as GMBProfile);
      if (hoursRes.data) setHours(hoursRes.data as unknown as GMBHour[]);
      if (qaRes.data) setQAs(qaRes.data as unknown as GMBQA[]);
      if (catRes.data) setCategories(catRes.data as unknown as GMBCategory[]);
      if (svcRes.data) setServices(svcRes.data as unknown as GMBService[]);
      if (auditRes.data) setAuditResults(auditRes.data as unknown as AuditResult[]);
    } catch (err) {
      console.error("Error loading GMB profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Connect GMB via Places API ──────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (!selectedPlace || !businessId) return;
    setConnecting(true);

    try {
      // Fetch full place details via Places API
      await loadGoogleMapsAPI();
      const service = new window.google.maps.places.PlacesService(document.createElement("div"));

      const detail: any = await new Promise((resolve, reject) => {
        service.getDetails(
          {
            placeId: selectedPlace.placeId,
            fields: ["place_id", "name", "formatted_address", "formatted_phone_number", "website", "rating", "user_ratings_total", "types", "opening_hours", "photos", "geometry", "url"],
          },
          (result: any, status: string) => {
            if (status === "OK" && result) resolve(result);
            else reject(new Error(status));
          },
        );
      });

      const photoUrls = (detail.photos || []).slice(0, 5).map((p: any) =>
        p.getUrl({ maxWidth: 800 })
      );

      // Upsert profile
      const profileData = {
        business_id: businessId,
        place_id: detail.place_id,
        business_name: detail.name,
        address: detail.formatted_address || null,
        phone: detail.formatted_phone_number || null,
        website: detail.website || null,
        rating: detail.rating || null,
        review_count: detail.user_ratings_total || 0,
        types: detail.types || [],
        photos: photoUrls,
        lat: detail.geometry?.location?.lat() || null,
        lng: detail.geometry?.location?.lng() || null,
        google_url: detail.url || null,
        overall_score: 0,
        last_scanned_at: new Date().toISOString(),
      };

      const { data: savedProfile, error: profErr } = await supabase
        .from("gmb_profiles")
        .upsert(profileData, { onConflict: "business_id" })
        .select()
        .single();

      if (profErr) throw profErr;

      // Seed hours from Google
      if (detail.opening_hours?.weekday_text) {
        const hoursData: GMBHour[] = DAYS.map((day) => {
          const text = detail.opening_hours.weekday_text.find((t: string) => t.toLowerCase().startsWith(day.toLowerCase()));
          if (!text || text.toLowerCase().includes("closed")) {
            return { business_id: businessId, day, open_time: "", close_time: "", is_closed: true };
          }
          const match = text.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*[–-]\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
          if (match) {
            return { business_id: businessId, day, open_time: match[1], close_time: match[2], is_closed: false };
          }
          return { business_id: businessId, day, open_time: "", close_time: "", is_closed: false };
        });

        const { error: hoursDelErr } = await supabase
          .from("gmb_hours")
          .delete()
          .eq("business_id", businessId);
        if (hoursDelErr) throw hoursDelErr;
        const { error: hoursInsErr } = await supabase
          .from("gmb_hours")
          .insert(hoursData as any[]);
        if (hoursInsErr) throw hoursInsErr;
        setHours(hoursData.map((h, i) => ({ ...h, id: String(i) })));
      }

      // Generate and save initial audit
      const auditItems = generateAuditFromPlace(detail);
      const { error: auditDelErr } = await supabase
        .from("gmb_audit_results")
        .delete()
        .eq("business_id", businessId);
      if (auditDelErr) throw auditDelErr;
      const { data: savedAudit, error: auditInsErr } = await supabase
        .from("gmb_audit_results")
        .insert(auditItems.map((a) => ({ ...a, business_id: businessId })))
        .select();
      if (auditInsErr) throw auditInsErr;

      // Compute overall score
      const good = auditItems.filter((a) => a.status === "good").length;
      const score = Math.round((good / auditItems.length) * 100);
      await supabase.from("gmb_profiles").update({ overall_score: score }).eq("business_id", businessId);

      setProfile({ ...(savedProfile as unknown as GMBProfile), overall_score: score });
      if (savedAudit) setAuditResults(savedAudit as unknown as AuditResult[]);
      setShowConnectFlow(false);
      setSelectedPlace(null);
      toast.success("Google My Business profile connected!");
    } catch (err: any) {
      console.error("Connection error:", err);
      toast.error("Failed to connect profile: " + (err.message || err));
    } finally {
      setConnecting(false);
    }
  }, [selectedPlace, businessId]);

  // ── Scan / refresh from Places API ─────────────────────────────────────────
  const handleScan = useCallback(async () => {
    if (!profile || !businessId) return;
    setScanning(true);
    try {
      await loadGoogleMapsAPI();
      const service = new window.google.maps.places.PlacesService(document.createElement("div"));

      const detail: any = await new Promise((resolve, reject) => {
        service.getDetails(
          {
            placeId: profile.place_id,
            fields: ["name", "formatted_address", "formatted_phone_number", "website", "rating", "user_ratings_total", "types", "opening_hours", "photos", "geometry", "url"],
          },
          (result: any, status: string) => {
            if (status === "OK" && result) resolve(result);
            else reject(new Error(status));
          },
        );
      });

      const photoUrls = (detail.photos || []).slice(0, 5).map((p: any) =>
        p.getUrl({ maxWidth: 800 })
      );

      const auditItems = generateAuditFromPlace(detail);
      const good = auditItems.filter((a) => a.status === "good").length;
      const score = Math.round((good / auditItems.length) * 100);

      // Update profile
      const updates = {
        business_name: detail.name,
        address: detail.formatted_address || null,
        phone: detail.formatted_phone_number || null,
        website: detail.website || null,
        rating: detail.rating || null,
        review_count: detail.user_ratings_total || 0,
        photos: photoUrls,
        overall_score: score,
        last_scanned_at: new Date().toISOString(),
      };
      await supabase.from("gmb_profiles").update(updates).eq("business_id", businessId);
      setProfile((p) => p ? { ...p, ...updates } : p);

      // Replace audit results
      await supabase.from("gmb_audit_results").delete().eq("business_id", businessId);
      const { data: savedAudit } = await supabase
        .from("gmb_audit_results")
        .insert(auditItems.map((a) => ({ ...a, business_id: businessId })))
        .select();
      if (savedAudit) setAuditResults(savedAudit as unknown as AuditResult[]);

      toast.success("Profile scanned and updated!");
    } catch (err: any) {
      toast.error("Scan failed: " + (err.message || err));
    } finally {
      setScanning(false);
    }
  }, [profile, businessId]);

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!businessId || !window.confirm("Disconnect this GMB profile? Local data will be removed.")) return;
    await supabase.from("gmb_profiles").delete().eq("business_id", businessId);
    await supabase.from("gmb_hours").delete().eq("business_id", businessId);
    await supabase.from("gmb_audit_results").delete().eq("business_id", businessId);
    setProfile(null);
    setHours([]);
    setAuditResults([]);
    toast.success("Profile disconnected.");
  };

  // ── Save hours ──────────────────────────────────────────────────────────────
  const handleSaveHours = async () => {
    if (!businessId) return;
    setSavingHours(true);
    try {
      const { error: delErr } = await supabase
        .from("gmb_hours")
        .delete()
        .eq("business_id", businessId);
      if (delErr) throw delErr;
      const toInsert = hours.map(({ id: _id, ...h }) => ({ ...h, business_id: businessId }));
      const { error: insErr } = await supabase.from("gmb_hours").insert(toInsert);
      if (insErr) throw insErr;
      setEditingHours(false);
      toast.success("Business hours saved!");
    } catch (err: any) {
      toast.error(`Failed to save hours: ${err?.message ?? "unknown error"}`);
    } finally {
      setSavingHours(false);
    }
  };

  // ── Q&A CRUD ────────────────────────────────────────────────────────────────
  const handleAddQA = async () => {
    if (!businessId || !newQA.question.trim() || !newQA.answer.trim()) {
      toast.error("Fill in both question and answer.");
      return;
    }
    setAddingQA(true);
    try {
      const { data, error } = await supabase.from("gmb_qas")
        .insert({ business_id: businessId, question: newQA.question, answer: newQA.answer, author: "Business Owner", source: "manual" })
        .select().single();
      if (error) throw error;
      setQAs((prev) => [data as unknown as GMBQA, ...prev]);
      setNewQA({ question: "", answer: "" });
      toast.success("Q&A added!");
    } catch {
      toast.error("Failed to add Q&A.");
    } finally {
      setAddingQA(false);
    }
  };

  const handleDeleteQA = async (id: string) => {
    const { error } = await supabase.from("gmb_qas").delete().eq("id", id);
    if (error) { toast.error("Failed to remove Q&A."); return; }
    setQAs((prev) => prev.filter((q) => q.id !== id));
    toast.success("Q&A removed.");
  };

  // ── Service CRUD ────────────────────────────────────────────────────────────
  const handleAddService = async (withAI = false) => {
    if (!businessId || !newService.name.trim()) { toast.error("Enter a service name."); return; }
    setAddingService(true);
    try {
      let desc = newService.description;
      if (withAI) {
        try {
          const { text } = await aiApi.serviceDescription(
            newService.name.trim(),
            profile?.business_name || undefined,
            profile?.address || undefined,
          );
          if (text?.trim()) desc = text.trim();
        } catch (err) {
          // Keep the user's own description; tell them why AI didn't run.
          toast.error(aiErrorMessage(err));
        }
      }
      const { data, error } = await supabase.from("gmb_services")
        .insert({ business_id: businessId, ...newService, description: desc })
        .select().single();
      if (error) throw error;
      setServices((prev) => [...prev, data as unknown as GMBService]);
      setNewService({ name: "", description: "", price: "", category: "", image_url: "" });
      toast.success("Service added!");
    } catch (err) {
      console.error("Failed to add service:", err);
      toast.error("Failed to add service.");
    } finally {
      setAddingService(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    const { error } = await supabase.from("gmb_services").delete().eq("id", id);
    if (error) { toast.error("Failed to remove service."); return; }
    setServices((prev) => prev.filter((s) => s.id !== id));
    toast.success("Service removed.");
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!businessId || !newCategory.trim()) return;
    setAddingCategory(true);
    try {
      const { data, error } = await supabase.from("gmb_categories")
        .insert({ business_id: businessId, name: newCategory, is_primary: false })
        .select().single();
      if (error) throw error;
      setCategories((prev) => [...prev, data as unknown as GMBCategory]);
      setNewCategory("");
      toast.success("Category added!");
    } catch {
      toast.error("Failed to add category.");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    await supabase.from("gmb_categories").delete().eq("id", id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast.success("Category removed.");
  };

  // ── Audit summary ───────────────────────────────────────────────────────────
  const auditSummary = {
    critical: auditResults.filter((a) => a.status === "critical").length,
    warning: auditResults.filter((a) => a.status === "warning").length,
    good: auditResults.filter((a) => a.status === "good").length,
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: "GMB Optimization" }]}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // ── No business selected ───────────────────────────────────────────────────
  if (!businessId) {
    return (
      <AppLayout breadcrumbs={[{ label: "GMB Optimization" }]}>
        <div className="container mx-auto px-4 py-16 max-w-lg text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Business Selected</h2>
          <p className="text-muted-foreground">Select a business from the sidebar to manage its Google My Business profile.</p>
        </div>
      </AppLayout>
    );
  }

  // ── Not connected: connection flow ─────────────────────────────────────────
  if (!profile) {
    return (
      <AppLayout breadcrumbs={[{ label: "GMB Optimization" }]}>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Connect Google My Business</h1>
            <p className="text-muted-foreground">
              Search for your business on Google to connect your profile and start optimizing your presence.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Find Your Business
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <BusinessPlacesSearch
                placeholder="Type your business name or address…"
                onPlaceSelect={(place) => setSelectedPlace(place)}
              />

              {selectedPlace && (
                <div className="border rounded-lg p-4 bg-muted/40 space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {selectedPlace.name}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedPlace.formattedAddress}
                  </div>
                  {selectedPlace.phoneNumber && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {selectedPlace.phoneNumber}
                    </div>
                  )}
                  {selectedPlace.rating && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-yellow-500" />
                      {selectedPlace.rating} ({selectedPlace.userRatingsTotal} reviews)
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                disabled={!selectedPlace || connecting}
                onClick={handleConnect}
              >
                {connecting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting…</>
                ) : (
                  <><Link2 className="h-4 w-4 mr-2" />Connect This Profile</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // ── Main UI (profile connected) ─────────────────────────────────────────────
  const { label: scoreLabel_, color: scoreColor } = scoreLabel(profile.overall_score);

  return (
    <AppLayout breadcrumbs={[{ label: "GMB Optimization" }]}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              GMB Optimization
            </h1>
            <p className="text-muted-foreground mt-1">Manage and optimize your Google My Business profile</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Last Scan</div>
              <div className="font-medium">
                {profile.last_scanned_at ? new Date(profile.last_scanned_at).toLocaleString() : "Never"}
              </div>
            </div>
            <Button onClick={handleScan} disabled={scanning} className="gap-2">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {scanning ? "Scanning…" : "Scan Profile"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect} className="gap-2 text-muted-foreground">
              <Unlink className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Profile summary card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-start">
              <div className="lg:col-span-2">
                <div className="text-xs text-muted-foreground mb-0.5">Business</div>
                <div className="font-semibold text-lg">{profile.business_name}</div>
                {profile.address && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />{profile.address}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Phone</div>
                <div className="font-medium">{profile.phone || <span className="text-muted-foreground">—</span>}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Rating</div>
                <div className="flex items-center gap-1 font-medium">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  {profile.rating ? `${Number(profile.rating).toFixed(1)} (${profile.review_count.toLocaleString()})` : "No reviews"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Optimization Score</div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${scoreColor}`}>{profile.overall_score}%</span>
                  <Badge variant="outline" className={scoreColor}>{scoreLabel_}</Badge>
                </div>
                {profile.google_url && (
                  <a href={profile.google_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-1">
                    View on Google <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Photo strip */}
            {profile.photos && profile.photos.length > 0 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                {profile.photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="h-20 w-28 object-cover rounded-md shrink-0 border" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="audit"><AlertTriangle className="h-4 w-4 mr-1.5" />Audit</TabsTrigger>
            <TabsTrigger value="hours"><Clock className="h-4 w-4 mr-1.5" />Hours</TabsTrigger>
            <TabsTrigger value="qa"><MessageSquare className="h-4 w-4 mr-1.5" />Q&amp;A</TabsTrigger>
            <TabsTrigger value="categories"><Settings className="h-4 w-4 mr-1.5" />Categories</TabsTrigger>
            <TabsTrigger value="services"><ImageIcon className="h-4 w-4 mr-1.5" />Services</TabsTrigger>
          </TabsList>

          {/* ── Audit Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="audit" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Critical Issues", count: auditSummary.critical, icon: AlertTriangle, bg: "bg-red-100", color: "text-red-600" },
                { label: "Warnings", count: auditSummary.warning, icon: AlertCircle, bg: "bg-yellow-100", color: "text-yellow-600" },
                { label: "Passing", count: auditSummary.good, icon: CheckCircle, bg: "bg-green-100", color: "text-green-600" },
              ].map(({ label, count, icon: Icon, bg, color }) => (
                <Card key={label}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
                    <div>
                      <div className={`text-2xl font-bold ${color}`}>{count}</div>
                      <div className="text-sm text-muted-foreground">{label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {auditResults.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Click <strong>Scan Profile</strong> to run your first audit.
              </CardContent></Card>
            ) : (
              <Card>
                <CardHeader><CardTitle>Audit Results</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {auditResults.map((item) => (
                    <div key={item.id} className={`rounded-lg border p-4 ${item.status === "critical" ? "border-red-200 bg-red-50" : item.status === "warning" ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{item.category}</Badge>
                            <span className="font-medium text-sm">{item.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{item.description}</p>
                          {item.status !== "good" && (
                            <p className="text-xs font-medium text-primary">→ {item.action_required}</p>
                          )}
                        </div>
                        <div className="ml-3 shrink-0">
                          {item.status === "critical" && <AlertTriangle className="h-5 w-5 text-red-500" />}
                          {item.status === "warning" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                          {item.status === "good" && <CheckCircle className="h-5 w-5 text-green-500" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Hours Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="hours" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Business Hours
                  {editingHours ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingHours(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
                      <Button size="sm" onClick={handleSaveHours} disabled={savingHours}>
                        {savingHours ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditingHours(true)}>
                      <Edit3 className="h-4 w-4 mr-1" />Edit Hours
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {DAYS.map((day) => {
                  const h = hours.find((h) => h.day === day) || { day, open_time: "09:00", close_time: "17:00", is_closed: false, business_id: businessId! };
                  return (
                    <div key={day} className="flex items-center gap-4">
                      <div className="w-28 font-medium text-sm">{day}</div>
                      {editingHours ? (
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="checkbox" checked={h.is_closed} onChange={(e) => {
                              setHours((prev) => {
                                const idx = prev.findIndex((p) => p.day === day);
                                const updated = idx >= 0 ? [...prev] : [...prev, { ...h }];
                                if (idx >= 0) updated[idx] = { ...updated[idx], is_closed: e.target.checked };
                                else updated[updated.length - 1].is_closed = e.target.checked;
                                return updated;
                              });
                            }} className="rounded" />
                            Closed
                          </label>
                          {!h.is_closed && (
                            <div className="flex items-center gap-2">
                              <Input type="time" value={h.open_time} className="w-32 h-8 text-sm"
                                onChange={(e) => setHours((prev) => {
                                  const idx = prev.findIndex((p) => p.day === day);
                                  if (idx < 0) return prev;
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], open_time: e.target.value };
                                  return updated;
                                })} />
                              <span className="text-muted-foreground text-sm">–</span>
                              <Input type="time" value={h.close_time} className="w-32 h-8 text-sm"
                                onChange={(e) => setHours((prev) => {
                                  const idx = prev.findIndex((p) => p.day === day);
                                  if (idx < 0) return prev;
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], close_time: e.target.value };
                                  return updated;
                                })} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {h.is_closed ? <span className="text-red-500">Closed</span> : `${h.open_time || "—"} – ${h.close_time || "—"}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Q&A Tab ───────────────────────────────────────────────────── */}
          <TabsContent value="qa" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle>Add New Q&amp;A</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Question</Label>
                  <Input value={newQA.question} onChange={(e) => setNewQA((p) => ({ ...p, question: e.target.value }))} placeholder="What question do customers often ask?" />
                </div>
                <div>
                  <Label>Answer</Label>
                  <Textarea value={newQA.answer} onChange={(e) => setNewQA((p) => ({ ...p, answer: e.target.value }))} placeholder="Your answer…" rows={3} />
                </div>
                <Button onClick={handleAddQA} disabled={addingQA} className="gap-2">
                  {addingQA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Q&amp;A
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Questions &amp; Answers ({qas.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {qas.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">No Q&amp;As yet.</p>}
                {qas.map((qa) => (
                  <div key={qa.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">Q: {qa.question}</div>
                        <div className="text-sm text-muted-foreground">A: {qa.answer}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDeleteQA(qa.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      By {qa.author} · {new Date(qa.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Categories Tab ───────────────────────────────────────────── */}
          <TabsContent value="categories" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Service Categories</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{cat.name}</span>
                      {cat.is_primary && <Badge>Primary</Badge>}
                    </div>
                    {!cat.is_primary && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDeleteCategory(cat.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Add a category…" className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()} />
                  <Button onClick={handleAddCategory} disabled={addingCategory || !newCategory.trim()} className="gap-1">
                    {addingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Services Tab ─────────────────────────────────────────────── */}
          <TabsContent value="services" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle>Add New Service</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Service Name</Label>
                    <Input value={newService.name} onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., Deep Clean" />
                  </div>
                  <div>
                    <Label>Price (Optional)</Label>
                    <Input value={newService.price} onChange={(e) => setNewService((p) => ({ ...p, price: e.target.value }))} placeholder="$99" />
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={newService.category} onChange={(e) => setNewService((p) => ({ ...p, category: e.target.value }))} placeholder="e.g., Cleaning, Plumbing" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={newService.description} onChange={(e) => setNewService((p) => ({ ...p, description: e.target.value }))} placeholder="Describe your service…" rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleAddService(false)} disabled={addingService} className="gap-2">
                    {addingService ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Service
                  </Button>
                  <Button variant="outline" onClick={() => handleAddService(true)} disabled={addingService} className="gap-2">
                    <Wand2 className="h-4 w-4" />Add with AI
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Services ({services.length})</CardTitle></CardHeader>
              <CardContent>
                {services.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">No services added yet.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.map((svc) => (
                    <div key={svc.id} className="border rounded-lg p-4 space-y-2">
                      {svc.image_url ? (
                        <img src={svc.image_url} alt={svc.name} className="w-full h-32 object-cover rounded-md" />
                      ) : (
                        <div className="w-full h-32 bg-muted rounded-md flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-sm">{svc.name}</div>
                          {svc.price && <div className="text-primary text-sm font-semibold">{svc.price}</div>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 -mt-1" onClick={() => handleDeleteService(svc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {svc.description && <p className="text-xs text-muted-foreground">{svc.description}</p>}
                      {svc.category && <Badge variant="outline" className="text-xs">{svc.category}</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

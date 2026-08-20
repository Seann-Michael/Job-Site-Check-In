import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Star,
  MapPin,
  BarChart3,
  MessageSquare,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { signInWithPassword } from "@/lib/auth";
import supabaseClient from "@/lib/supabaseClient";

interface LoginFormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

const slides = [
  {
    icon: MapPin,
    tag: "Local SEO",
    headline: "Dominate Local Search Results",
    body: "Automatically optimize your Google Business Profile with AI-generated posts, photo uploads, and real-time ranking insights — all from one dashboard.",
    stat: { value: "3.2×", label: "average increase in map views" },
    color: "from-blue-600 to-indigo-700",
  },
  {
    icon: Star,
    tag: "Review Management",
    headline: "Turn Happy Customers Into 5-Star Reviews",
    body: "Send automated review requests via SMS or email right after a job is done. Our review gate filters unhappy customers before they post publicly.",
    stat: { value: "4.8★", label: "average rating across all clients" },
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: BarChart3,
    tag: "Analytics",
    headline: "Know Exactly What's Working",
    body: "Track calls, clicks, direction requests, and photo views from Google. See which jobs and keywords are driving the most revenue.",
    stat: { value: "68%", label: "more calls reported by clients in 90 days" },
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: MessageSquare,
    tag: "Automation",
    headline: "Follow Up Without Lifting a Finger",
    body: "Set up workflows that send review requests, project updates, and invoices automatically — triggered by job status changes in real time.",
    stat: { value: "5 hrs", label: "saved per week on average" },
    color: "from-purple-600 to-violet-700",
  },
  {
    icon: TrendingUp,
    tag: "Social Proof",
    headline: "Trusted by Local Service Businesses",
    body: "From HVAC and plumbing to landscaping and roofing — contractors across North America use Local SEO Ranker to grow their Google presence.",
    stat: { value: "500+", label: "businesses actively growing on Google" },
    color: "from-rose-500 to-pink-600",
  },
];

const testimonials = [
  {
    quote: "We went from 12 reviews to over 80 in 3 months. The automation did all the heavy lifting.",
    name: "Mike T.",
    company: "Cuyahoga Container Service",
  },
  {
    quote: "Our Google ranking jumped from page 3 to the top 3 map pack within 6 weeks.",
    name: "Sarah L.",
    company: "Sunrise Plumbing & Heating",
  },
  {
    quote: "The review gate alone saved us from a bad review. Game changer for our business.",
    name: "James R.",
    company: "Apex Concrete & Paving",
  },
];

// Google OAuth is configured outside the app; only enable the button when it is.
const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";

// Slides can come from Supabase (managed by Super Admin) or fall back to defaults
type SlideSource = typeof slides[number] & { image_url?: string };

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSlides, setActiveSlides] = useState<SlideSource[]>(slides);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Fetch custom slides from Supabase; keep defaults if none configured
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const { data } = await supabaseClient
          .from("login_slides")
          .select("*")
          .eq("active", true)
          .order("sort_order");
        if (data && data.length > 0) {
          const mapped: SlideSource[] = data.map((row: any) => ({
            icon: MapPin,
            tag: row.tag,
            headline: row.headline,
            body: row.body,
            stat: { value: row.stat_value, label: row.stat_label },
            color: row.color,
            image_url: row.image_url || undefined,
          }));
          setActiveSlides(mapped);
        }
      } catch {
        // silently keep defaults
      }
    };
    fetchSlides();
  }, []);
  const [formData, setFormData] = useState<LoginFormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/admin/jobs`,
          scopes: "email profile",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => goToSlide((currentSlide + 1) % activeSlides.length), 5000);
    return () => clearInterval(timer);
  }, [currentSlide]);

  const goToSlide = (index: number) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setAnimating(false);
    }, 300);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setErrors({});
    try {
      await signInWithPassword(formData.email, formData.password);
      toast.success("Login successful!");
      const from =
        (location.state as { from?: { pathname?: string } } | null)?.from
          ?.pathname || "/admin/jobs";
      navigate(from, { replace: true });
    } catch (err: any) {
      const message: string = err?.message || "Something went wrong. Please try again.";
      if (/email not confirmed/i.test(message)) {
        setErrors({
          general:
            "Your email isn't confirmed yet. Please check your inbox for the confirmation link.",
        });
      } else if (/invalid login credentials/i.test(message)) {
        setErrors({ general: "Invalid email or password" });
      } else {
        setErrors({ general: message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const slide = activeSlides[currentSlide] ?? activeSlides[0];
  const SlideIcon = slide.icon;
  const testimonial = testimonials[currentSlide % testimonials.length];

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT: Login Form ── */}
      <div className="w-full lg:w-[38%] flex flex-col justify-center px-8 py-12 bg-background">
        <div className="mx-auto w-full max-w-sm">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Local SEO Ranker</span>
          </div>

          <h1 className="text-3xl font-bold mb-1">Welcome back</h1>
          <p className="text-muted-foreground mb-8">Sign in to manage your account</p>

          {/* ── Email / Password (primary) ── */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.general && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.general}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={`pl-10 h-11 ${errors.email ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={`pl-10 pr-10 h-11 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-11 font-semibold">
                {isLoading ? "Signing in…" : "Sign In"}
              </Button>
            </form>

          {/* ── Divider ── */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
            </div>
          </div>

          {/* ── Google Sign-In (secondary; disabled until the provider is configured) ── */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 font-medium gap-3"
            disabled={!GOOGLE_AUTH_ENABLED || isGoogleLoading}
            title={GOOGLE_AUTH_ENABLED ? undefined : "Google sign-in coming soon"}
            onClick={handleGoogleSignIn}
          >
            {isGoogleLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {GOOGLE_AUTH_ENABLED ? "Continue with Google" : "Google sign-in coming soon"}
          </Button>

          {/* ── Disclosure ── */}
          <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
            By signing in, you agree to our{" "}
            <Link to="/help" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>{" "}
            &amp;{" "}
            <Link to="/help" className="underline underline-offset-2 hover:text-foreground">
              Terms of Service
            </Link>
          </p>

          <p className="mt-4 text-center text-sm">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:underline text-base">
              Sign Up Here
            </Link>
          </p>
        </div>
      </div>

      {/* ── RIGHT: Feature Slides ── */}
      <div
        className={`hidden lg:flex lg:w-[62%] bg-gradient-to-br ${slide.color} transition-all duration-700 flex-col relative overflow-hidden`}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white" />
          <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-white" />
        </div>

        <div className="relative flex flex-col h-full p-12 justify-between">
          {/* Top: Slide content */}
          <div
            className="flex-1 flex flex-col justify-center"
            style={{ opacity: animating ? 0 : 1, transition: "opacity 0.3s ease" }}
          >
            {/* Tag */}
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 w-fit mb-6">
              <SlideIcon className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">{slide.tag}</span>
            </div>

            {/* Headline */}
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              {slide.headline}
            </h2>

            {/* Body */}
            <p className="text-white/80 text-lg leading-relaxed mb-8 max-w-md">
              {slide.body}
            </p>

            {/* Stat */}
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 w-fit border border-white/20">
              <div className="text-4xl font-bold text-white mb-1">{slide.stat.value}</div>
              <div className="text-white/70 text-sm">{slide.stat.label}</div>
            </div>
          </div>

          {/* Bottom: Testimonial + controls */}
          <div>
            {/* Testimonial */}
            <div
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 mb-6"
              style={{ opacity: animating ? 0 : 1, transition: "opacity 0.3s ease" }}
            >
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-white/90 text-sm italic mb-3">"{testimonial.quote}"</p>
              <div>
                <p className="text-white font-semibold text-sm">{testimonial.name}</p>
                <p className="text-white/60 text-xs">{testimonial.company}</p>
              </div>
            </div>

            {/* Slide controls */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {activeSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === currentSlide
                        ? "bg-white w-6 h-2"
                        : "bg-white/40 w-2 h-2 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => goToSlide((currentSlide - 1 + activeSlides.length) % activeSlides.length)}
                  className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center border border-white/20 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={() => goToSlide((currentSlide + 1) % activeSlides.length)}
                  className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center border border-white/20 transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

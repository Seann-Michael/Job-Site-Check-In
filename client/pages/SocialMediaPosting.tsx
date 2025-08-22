import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Plus,
  Wand2,
  Upload,
  Calendar,
  Share2,
  BarChart3,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Building2,
  ImageIcon,
  Hash,
  AtSign,
  MapPin,
  Clock,
  Send,
  Eye,
  Sparkles,
  Target,
  Palette,
  FileText,
  Settings,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface SocialMediaPost {
  id?: string;
  title: string;
  platform: 'gmb' | 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  content: string;
  hashtags?: string[];
  mentions?: string[];
  target_keywords?: string[];
  target_location?: string;
  scheduled_for?: string;
  status?: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  images?: any[];
  primary_image_url?: string;
  syndicated_to?: string[];
  created_at?: string;
  content_length?: number;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  engagement_rate?: number;
}

interface GeneratedContent {
  content: string;
  hashtags: string[];
  characterCount: number;
  suggestedImages: string[];
  engagementTips: string[];
}

interface GeneratedImage {
  imageUrl: string;
  revisedPrompt: string;
  dimensions: { width: number; height: number };
  suggestedUsage: string[];
  alternativePrompts: string[];
}

interface KeywordCluster {
  id: string;
  name: string;
  primary_keyword: string;
  keywords: KeywordData[];
  total_search_volume: number;
  avg_difficulty: number;
  avg_cpc: number;
  search_intent: string;
  content_opportunities: string[];
}

interface KeywordData {
  keyword: string;
  search_volume: number;
  competition: number;
  competition_level: 'low' | 'medium' | 'high';
  cpc: number;
  difficulty: number;
  search_intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
}

interface BulkPostingConfig {
  campaignName: string;
  totalPosts: number;
  startDate: string;
  endDate: string;
  postsPerDay: number;
  preferredTimes: string[];
  skipWeekends: boolean;
  platforms: string[];
  contentTypes: string[];
  tones: string[];
  includeImages: boolean;
  diversityLevel: 'low' | 'medium' | 'high';
  keywordRotation: boolean;
}

const PLATFORM_ICONS = {
  gmb: Building2,
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin
};

const PLATFORM_NAMES = {
  gmb: 'Google My Business',
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'Twitter',
  linkedin: 'LinkedIn'
};

const PLATFORM_LIMITS = {
  gmb: 1500,
  facebook: 63206,
  instagram: 2200,
  twitter: 280,
  linkedin: 3000
};

const CONTENT_TYPES = [
  { value: 'promotional', label: 'Promotional', description: 'Promote services and offers' },
  { value: 'educational', label: 'Educational', description: 'Share tips and knowledge' },
  { value: 'engagement', label: 'Engagement', description: 'Encourage interaction' },
  { value: 'behind-scenes', label: 'Behind the Scenes', description: 'Show authentic moments' },
  { value: 'announcement', label: 'Announcement', description: 'Share news and updates' }
];

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'conversational', label: 'Conversational' }
];

const IMAGE_STYLES = [
  { value: 'professional', label: 'Professional' },
  { value: 'modern', label: 'Modern' },
  { value: 'creative', label: 'Creative' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'vibrant', label: 'Vibrant' },
  { value: 'corporate', label: 'Corporate' }
];

const IMAGE_TYPES = [
  { value: 'service_showcase', label: 'Service Showcase' },
  { value: 'behind_scenes', label: 'Behind the Scenes' },
  { value: 'team_photo', label: 'Team Photo' },
  { value: 'product_display', label: 'Product Display' },
  { value: 'location_shot', label: 'Location Shot' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'educational', label: 'Educational' }
];

export default function SocialMediaPosting() {
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [selectedTab, setSelectedTab] = useState("create");
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Partial<SocialMediaPost>>({
    title: '',
    platform: 'gmb',
    content: '',
    hashtags: [],
    mentions: [],
    target_keywords: [],
    target_location: '',
    status: 'draft'
  });

  // AI generation state
  const [aiSettings, setAiSettings] = useState({
    businessName: '',
    businessType: '',
    contentType: 'promotional',
    tone: 'professional',
    callToAction: '',
    additionalContext: ''
  });

  // Image generation state
  const [imageSettings, setImageSettings] = useState({
    prompt: '',
    style: 'professional',
    imageType: 'service_showcase',
    includeText: false,
    size: '1024x1024'
  });

  // Syndication state
  const [syndicationSettings, setSyndicationSettings] = useState({
    targetPlatforms: [] as string[],
    scheduleDelay: 0,
    preserveScheduling: true
  });

  // UI state
  const [expandedSections, setExpandedSections] = useState({
    aiGeneration: false,
    imageGeneration: false,
    syndication: false,
    scheduling: false
  });

  // Keyword research state
  const [keywordClusters, setKeywordClusters] = useState<KeywordCluster[]>([]);
  const [keywordResearchLoading, setKeywordResearchLoading] = useState(false);
  const [seedKeywords, setSeedKeywords] = useState<string>('');
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);

  // Bulk posting state
  const [bulkConfig, setBulkConfig] = useState<BulkPostingConfig>({
    campaignName: '',
    totalPosts: 30,
    startDate: '',
    endDate: '',
    postsPerDay: 1,
    preferredTimes: ['09:00', '14:00', '18:00'],
    skipWeekends: false,
    platforms: ['gmb'],
    contentTypes: ['promotional', 'educational'],
    tones: ['professional', 'friendly'],
    includeImages: false,
    diversityLevel: 'medium',
    keywordRotation: true
  });
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const breadcrumbs = [
    { label: "Social Posting" },
  ];

  // Load posts on component mount
  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/social-media-posts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Check if response is HTML (development mode without Netlify functions)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        // Development mode - API endpoints not available
        console.warn('API endpoints not available in development mode');
        setPosts([]); // Set empty posts array
        toast.info('Running in development mode - API features limited');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      } else {
        console.error('API response error:', response.status, response.statusText);
        toast.error('Failed to load posts');
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      // Check if it's a JSON parsing error from HTML response
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        console.warn('API endpoint returned HTML instead of JSON - likely development mode');
        setPosts([]);
        toast.info('Running in development mode - API features limited');
      } else {
        toast.error('Error loading posts');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateAIContent = async () => {
    if (!aiSettings.businessName || !formData.target_keywords?.length) {
      toast.error('Please provide business name and target keywords');
      return;
    }

    setAiGenerating(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/social-media-content-generator', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: formData.platform,
          targetKeywords: formData.target_keywords,
          businessName: aiSettings.businessName,
          businessType: aiSettings.businessType,
          targetLocation: formData.target_location,
          contentType: aiSettings.contentType,
          tone: aiSettings.tone,
          callToAction: aiSettings.callToAction,
          additionalContext: aiSettings.additionalContext
        }),
      });

      // Check if response is HTML (development mode)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        toast.error('AI content generation not available in development mode');
        return;
      }

      if (response.ok) {
        const generatedContent: GeneratedContent = await response.json();
        setFormData(prev => ({
          ...prev,
          content: generatedContent.content,
          hashtags: generatedContent.hashtags
        }));
        toast.success('AI content generated successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate content');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        toast.error('AI content generation not available in development mode');
      } else {
        toast.error('Error generating content');
      }
    } finally {
      setAiGenerating(false);
    }
  };

  const generateAIImage = async () => {
    if (!imageSettings.prompt || !aiSettings.businessName) {
      toast.error('Please provide image prompt and business name');
      return;
    }

    setImageGenerating(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/social-media-image-generator', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: imageSettings.prompt,
          businessName: aiSettings.businessName,
          businessType: aiSettings.businessType,
          platform: formData.platform,
          style: imageSettings.style,
          imageType: imageSettings.imageType,
          includeText: imageSettings.includeText,
          size: imageSettings.size
        }),
      });

      if (response.ok) {
        const generatedImage: GeneratedImage = await response.json();
        setFormData(prev => ({
          ...prev,
          primary_image_url: generatedImage.imageUrl,
          images: [{
            url: generatedImage.imageUrl,
            type: 'ai_generated',
            prompt: imageSettings.prompt,
            style: imageSettings.style
          }]
        }));
        toast.success('AI image generated successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Error generating image');
    } finally {
      setImageGenerating(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    try {
      // In a real implementation, you would upload to Supabase storage
      // For now, we'll create a temporary URL
      const imageUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        primary_image_url: imageUrl,
        images: [{
          url: imageUrl,
          type: 'upload',
          filename: file.name,
          size: file.size
        }]
      }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error uploading image');
    }
  };

  const savePost = async () => {
    if (!formData.title || !formData.content) {
      toast.error('Please provide title and content');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/social-media-posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newPost = await response.json();
        setPosts(prev => [newPost, ...prev]);
        
        // Reset form
        setFormData({
          title: '',
          platform: 'gmb',
          content: '',
          hashtags: [],
          mentions: [],
          target_keywords: [],
          target_location: '',
          status: 'draft'
        });
        
        setSelectedTab("manage");
        toast.success('Post saved successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save post');
      }
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error('Error saving post');
    } finally {
      setLoading(false);
    }
  };

  const schedulePost = async () => {
    if (!formData.scheduled_for) {
      toast.error('Please select a schedule time');
      return;
    }

    const postData = {
      ...formData,
      status: 'scheduled'
    };

    setLoading(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/social-media-posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      });

      if (response.ok) {
        const newPost = await response.json();
        setPosts(prev => [newPost, ...prev]);
        setSelectedTab("manage");
        toast.success('Post scheduled successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to schedule post');
      }
    } catch (error) {
      console.error('Error scheduling post:', error);
      toast.error('Error scheduling post');
    } finally {
      setLoading(false);
    }
  };

  const syndicatePost = async (postId: string) => {
    if (!syndicationSettings.targetPlatforms.length) {
      toast.error('Please select target platforms for syndication');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/social-media-syndication/syndicate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          targetPlatforms: syndicationSettings.targetPlatforms,
          scheduleDelay: syndicationSettings.scheduleDelay,
          preserveScheduling: syndicationSettings.preserveScheduling
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Successfully syndicated to ${result.totalCreated} platforms`);
        loadPosts(); // Reload to show new syndicated posts
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to syndicate post');
      }
    } catch (error) {
      console.error('Error syndicating post:', error);
      toast.error('Error syndicating post');
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch(`/api/social-media-posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setPosts(prev => prev.filter(post => post.id !== postId));
        toast.success('Post deleted successfully');
      } else {
        toast.error('Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Error deleting post');
    }
  };

  const performKeywordResearch = async () => {
    if (!seedKeywords.trim()) {
      toast.error('Please enter seed keywords');
      return;
    }

    setKeywordResearchLoading(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/keyword-research', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seedKeywords: seedKeywords.split(',').map(k => k.trim()),
          location: formData.target_location || 'United States',
          maxResults: 100,
          minSearchVolume: 50
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setKeywordClusters(data.clusters || []);
        toast.success(`Found ${data.clusters?.length || 0} keyword clusters`);
        if (data.source === 'mock') {
          toast.info('Using demo data - connect DataForSEO for real keyword data');
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to perform keyword research');
      }
    } catch (error) {
      console.error('Error performing keyword research:', error);
      toast.error('Error performing keyword research');
    } finally {
      setKeywordResearchLoading(false);
    }
  };

  const createBulkPosts = async () => {
    if (!bulkConfig.campaignName || !bulkConfig.startDate || !bulkConfig.endDate) {
      toast.error('Please fill in campaign name, start date, and end date');
      return;
    }

    if (!aiSettings.businessName || !formData.target_keywords?.length) {
      toast.error('Please provide business name and target keywords');
      return;
    }

    setBulkGenerating(true);
    try {
      const token = localStorage.getItem('supabase_auth_token');
      const response = await fetch('/api/bulk-social-posting', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...bulkConfig,
          businessName: aiSettings.businessName,
          businessType: aiSettings.businessType,
          targetKeywords: formData.target_keywords,
          targetLocation: formData.target_location || 'United States',
          timezone: 'America/New_York' // Could be made configurable
        }),
      });

      if (response.ok) {
        const results = await response.json();
        setBulkResults(results);
        toast.success(`Successfully created ${results.postsCreated} posts!`);

        if (results.errors && results.errors.length > 0) {
          toast.warning(`Some posts had issues: ${results.errors.length} errors`);
        }

        // Refresh posts list
        loadPosts();
        setSelectedTab("manage");
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create bulk posts');
      }
    } catch (error) {
      console.error('Error creating bulk posts:', error);
      toast.error('Error creating bulk posts');
    } finally {
      setBulkGenerating(false);
    }
  };

  const useKeywordCluster = (cluster: KeywordCluster) => {
    const keywords = cluster.keywords.map(k => k.keyword).slice(0, 5); // Use top 5 keywords
    setFormData(prev => ({
      ...prev,
      target_keywords: keywords
    }));

    // Auto-fill some AI settings based on the cluster
    setAiSettings(prev => ({
      ...prev,
      contentType: cluster.search_intent === 'transactional' ? 'promotional' :
                  cluster.search_intent === 'informational' ? 'educational' : 'engagement'
    }));

    toast.success(`Applied keywords from "${cluster.name}" cluster`);
    setSelectedTab("create");
  };

  const getCharacterCount = () => {
    const content = formData.content || '';
    const hashtags = (formData.hashtags || []).join(' ');
    return content.length + (hashtags.length > 0 ? hashtags.length + 1 : 0);
  };

  const getCharacterLimit = () => {
    return PLATFORM_LIMITS[formData.platform as keyof typeof PLATFORM_LIMITS] || 1000;
  };

  const isOverLimit = () => {
    return getCharacterCount() > getCharacterLimit();
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Share2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              Social Posting
            </h1>
            <p className="text-muted-foreground">
              Create and manage GMB updates and social media posts with AI assistance and bulk scheduling
            </p>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Post
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Bulk Create
            </TabsTrigger>
            <TabsTrigger value="keywords" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Keywords
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Manage Posts
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Create Post Tab */}
          <TabsContent value="create" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Edit3 className="h-5 w-5" />
                      Post Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Title */}
                    <div>
                      <Label htmlFor="title">Post Title *</Label>
                      <Input
                        id="title"
                        value={formData.title || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter post title..."
                      />
                    </div>

                    {/* Platform Selection */}
                    <div>
                      <Label htmlFor="platform">Platform *</Label>
                      <Select 
                        value={formData.platform} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PLATFORM_NAMES).map(([key, name]) => {
                            const Icon = PLATFORM_ICONS[key as keyof typeof PLATFORM_ICONS];
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Content */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="content">Content *</Label>
                        <div className={`text-sm ${isOverLimit() ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {getCharacterCount()}/{getCharacterLimit()}
                        </div>
                      </div>
                      <Textarea
                        id="content"
                        value={formData.content || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Write your post content..."
                        rows={6}
                        className={isOverLimit() ? 'border-red-500' : ''}
                      />
                      {isOverLimit() && (
                        <p className="text-sm text-red-500 mt-1">
                          Content exceeds platform limit
                        </p>
                      )}
                    </div>

                    {/* Keywords */}
                    <div>
                      <Label htmlFor="keywords">Target Keywords</Label>
                      <Input
                        id="keywords"
                        value={(formData.target_keywords || []).join(', ')}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          target_keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                        }))}
                        placeholder="Enter keywords separated by commas..."
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <Label htmlFor="location">Target Location</Label>
                      <Input
                        id="location"
                        value={formData.target_location || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, target_location: e.target.value }))}
                        placeholder="e.g., New York, NY"
                      />
                    </div>

                    {/* Hashtags */}
                    <div>
                      <Label htmlFor="hashtags">Hashtags</Label>
                      <Input
                        id="hashtags"
                        value={(formData.hashtags || []).join(' ')}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          hashtags: e.target.value.split(' ').filter(h => h.startsWith('#'))
                        }))}
                        placeholder="#hashtag1 #hashtag2 #hashtag3"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* AI Content Generation */}
                <Card>
                  <Collapsible 
                    open={expandedSections.aiGeneration} 
                    onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, aiGeneration: open }))}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5" />
                            AI Content Generation
                          </div>
                          {expandedSections.aiGeneration ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="businessName">Business Name *</Label>
                            <Input
                              id="businessName"
                              value={aiSettings.businessName}
                              onChange={(e) => setAiSettings(prev => ({ ...prev, businessName: e.target.value }))}
                              placeholder="Your business name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="businessType">Business Type</Label>
                            <Input
                              id="businessType"
                              value={aiSettings.businessType}
                              onChange={(e) => setAiSettings(prev => ({ ...prev, businessType: e.target.value }))}
                              placeholder="e.g., Restaurant, Law Firm, etc."
                            />
                          </div>
                          <div>
                            <Label htmlFor="contentType">Content Type</Label>
                            <Select 
                              value={aiSettings.contentType} 
                              onValueChange={(value) => setAiSettings(prev => ({ ...prev, contentType: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONTENT_TYPES.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div>
                                      <div className="font-medium">{type.label}</div>
                                      <div className="text-sm text-muted-foreground">{type.description}</div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="tone">Tone</Label>
                            <Select 
                              value={aiSettings.tone} 
                              onValueChange={(value) => setAiSettings(prev => ({ ...prev, tone: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TONE_OPTIONS.map(tone => (
                                  <SelectItem key={tone.value} value={tone.value}>
                                    {tone.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="callToAction">Call to Action</Label>
                          <Input
                            id="callToAction"
                            value={aiSettings.callToAction}
                            onChange={(e) => setAiSettings(prev => ({ ...prev, callToAction: e.target.value }))}
                            placeholder="e.g., Call now for a free consultation"
                          />
                        </div>

                        <div>
                          <Label htmlFor="additionalContext">Additional Context</Label>
                          <Textarea
                            id="additionalContext"
                            value={aiSettings.additionalContext}
                            onChange={(e) => setAiSettings(prev => ({ ...prev, additionalContext: e.target.value }))}
                            placeholder="Any additional context or specific instructions..."
                            rows={3}
                          />
                        </div>

                        <Button 
                          onClick={generateAIContent} 
                          disabled={aiGenerating || !aiSettings.businessName}
                          className="w-full"
                        >
                          {aiGenerating ? (
                            <>
                              <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                              Generating Content...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-2" />
                              Generate AI Content
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>

                {/* Image Generation/Upload */}
                <Card>
                  <Collapsible 
                    open={expandedSections.imageGeneration} 
                    onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, imageGeneration: open }))}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            Image & Media
                          </div>
                          {expandedSections.imageGeneration ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        {/* Current Image Preview */}
                        {formData.primary_image_url && (
                          <div className="relative">
                            <img 
                              src={formData.primary_image_url} 
                              alt="Post image" 
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setFormData(prev => ({ ...prev, primary_image_url: '', images: [] }))}
                              className="absolute top-2 right-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        {/* Upload Button */}
                        <div>
                          <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Image
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </div>

                        <Separator />

                        {/* AI Image Generation */}
                        <div className="space-y-4">
                          <h4 className="font-medium flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            AI Image Generation
                          </h4>
                          
                          <div>
                            <Label htmlFor="imagePrompt">Image Description</Label>
                            <Textarea
                              id="imagePrompt"
                              value={imageSettings.prompt}
                              onChange={(e) => setImageSettings(prev => ({ ...prev, prompt: e.target.value }))}
                              placeholder="Describe the image you want to generate..."
                              rows={3}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="imageStyle">Style</Label>
                              <Select 
                                value={imageSettings.style} 
                                onValueChange={(value) => setImageSettings(prev => ({ ...prev, style: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_STYLES.map(style => (
                                    <SelectItem key={style.value} value={style.value}>
                                      {style.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="imageType">Image Type</Label>
                              <Select 
                                value={imageSettings.imageType} 
                                onValueChange={(value) => setImageSettings(prev => ({ ...prev, imageType: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_TYPES.map(type => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Button 
                            onClick={generateAIImage} 
                            disabled={imageGenerating || !imageSettings.prompt || !aiSettings.businessName}
                            className="w-full"
                          >
                            {imageGenerating ? (
                              <>
                                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                                Generating Image...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate AI Image
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {formData.platform && (
                          <>
                            {React.createElement(PLATFORM_ICONS[formData.platform], { 
                              className: "h-5 w-5" 
                            })}
                            <span className="font-medium">
                              {PLATFORM_NAMES[formData.platform]}
                            </span>
                          </>
                        )}
                      </div>
                      
                      {formData.primary_image_url && (
                        <img 
                          src={formData.primary_image_url} 
                          alt="Preview" 
                          className="w-full h-32 object-cover rounded"
                        />
                      )}
                      
                      <div className="text-sm">
                        <div className="font-medium mb-1">{formData.title || 'Post Title'}</div>
                        <div className="text-muted-foreground whitespace-pre-wrap">
                          {formData.content || 'Your post content will appear here...'}
                        </div>
                        {formData.hashtags && formData.hashtags.length > 0 && (
                          <div className="mt-2 text-blue-600">
                            {formData.hashtags.join(' ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Scheduling */}
                <Card>
                  <Collapsible 
                    open={expandedSections.scheduling} 
                    onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, scheduling: open }))}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Scheduling
                          </div>
                          {expandedSections.scheduling ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="scheduledFor">Schedule For</Label>
                          <Input
                            id="scheduledFor"
                            type="datetime-local"
                            value={formData.scheduled_for || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, scheduled_for: e.target.value }))}
                          />
                        </div>
                        <Button onClick={schedulePost} disabled={loading} className="w-full">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Post
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>

                {/* Syndication */}
                <Card>
                  <Collapsible 
                    open={expandedSections.syndication} 
                    onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, syndication: open }))}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Share2 className="h-5 w-5" />
                            Syndication
                          </div>
                          {expandedSections.syndication ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Target Platforms</Label>
                          <div className="space-y-2 mt-2">
                            {Object.entries(PLATFORM_NAMES)
                              .filter(([key]) => key !== formData.platform)
                              .map(([key, name]) => {
                                const Icon = PLATFORM_ICONS[key as keyof typeof PLATFORM_ICONS];
                                return (
                                  <label key={key} className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={syndicationSettings.targetPlatforms.includes(key)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSyndicationSettings(prev => ({
                                            ...prev,
                                            targetPlatforms: [...prev.targetPlatforms, key]
                                          }));
                                        } else {
                                          setSyndicationSettings(prev => ({
                                            ...prev,
                                            targetPlatforms: prev.targetPlatforms.filter(p => p !== key)
                                          }));
                                        }
                                      }}
                                    />
                                    <Icon className="h-4 w-4" />
                                    <span>{name}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="scheduleDelay">Schedule Delay (minutes)</Label>
                          <Input
                            id="scheduleDelay"
                            type="number"
                            value={syndicationSettings.scheduleDelay}
                            onChange={(e) => setSyndicationSettings(prev => ({ 
                              ...prev, 
                              scheduleDelay: parseInt(e.target.value) || 0 
                            }))}
                            min="0"
                          />
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>

                {/* Actions */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <Button onClick={savePost} disabled={loading} className="w-full">
                        <Send className="h-4 w-4 mr-2" />
                        Save as Draft
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setFormData({
                            title: '',
                            platform: 'gmb',
                            content: '',
                            hashtags: [],
                            mentions: [],
                            target_keywords: [],
                            target_location: '',
                            status: 'draft'
                          });
                        }}
                        className="w-full"
                      >
                        Clear Form
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Bulk Create Tab */}
          <TabsContent value="bulk" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bulk Configuration */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Bulk Campaign Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="campaignName">Campaign Name *</Label>
                      <Input
                        id="campaignName"
                        value={bulkConfig.campaignName}
                        onChange={(e) => setBulkConfig(prev => ({ ...prev, campaignName: e.target.value }))}
                        placeholder="e.g., Holiday Marketing Campaign"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="totalPosts">Total Posts</Label>
                        <Input
                          id="totalPosts"
                          type="number"
                          value={bulkConfig.totalPosts}
                          onChange={(e) => setBulkConfig(prev => ({ ...prev, totalPosts: parseInt(e.target.value) || 1 }))}
                          min="1"
                          max="100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="startDate">Start Date *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={bulkConfig.startDate}
                          onChange={(e) => setBulkConfig(prev => ({ ...prev, startDate: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">End Date *</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={bulkConfig.endDate}
                          onChange={(e) => setBulkConfig(prev => ({ ...prev, endDate: e.target.value }))}
                          min={bulkConfig.startDate}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="postsPerDay">Posts Per Day</Label>
                        <Input
                          id="postsPerDay"
                          type="number"
                          value={bulkConfig.postsPerDay}
                          onChange={(e) => setBulkConfig(prev => ({ ...prev, postsPerDay: parseInt(e.target.value) || 1 }))}
                          min="1"
                          max="10"
                        />
                      </div>
                      <div>
                        <Label>Platforms</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(PLATFORM_NAMES).map(([key, name]) => {
                            const Icon = PLATFORM_ICONS[key as keyof typeof PLATFORM_ICONS];
                            return (
                              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={bulkConfig.platforms.includes(key)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setBulkConfig(prev => ({
                                        ...prev,
                                        platforms: [...prev.platforms, key]
                                      }));
                                    } else {
                                      setBulkConfig(prev => ({
                                        ...prev,
                                        platforms: prev.platforms.filter(p => p !== key)
                                      }));
                                    }
                                  }}
                                />
                                <Icon className="h-4 w-4" />
                                <span className="text-sm">{name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Preferred Posting Times</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['09:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map(time => (
                          <label key={time} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bulkConfig.preferredTimes.includes(time)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBulkConfig(prev => ({
                                    ...prev,
                                    preferredTimes: [...prev.preferredTimes, time]
                                  }));
                                } else {
                                  setBulkConfig(prev => ({
                                    ...prev,
                                    preferredTimes: prev.preferredTimes.filter(t => t !== time)
                                  }));
                                }
                              }}
                            />
                            <span className="text-sm">{time}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="skipWeekends"
                        checked={bulkConfig.skipWeekends}
                        onChange={(e) => setBulkConfig(prev => ({ ...prev, skipWeekends: e.target.checked }))}
                      />
                      <Label htmlFor="skipWeekends">Skip weekends</Label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Content Variation Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Content Types</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {CONTENT_TYPES.map(type => (
                          <label key={type.value} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bulkConfig.contentTypes.includes(type.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBulkConfig(prev => ({
                                    ...prev,
                                    contentTypes: [...prev.contentTypes, type.value]
                                  }));
                                } else {
                                  setBulkConfig(prev => ({
                                    ...prev,
                                    contentTypes: prev.contentTypes.filter(t => t !== type.value)
                                  }));
                                }
                              }}
                            />
                            <span className="text-sm">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Tones</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {TONE_OPTIONS.map(tone => (
                          <label key={tone.value} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bulkConfig.tones.includes(tone.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBulkConfig(prev => ({
                                    ...prev,
                                    tones: [...prev.tones, tone.value]
                                  }));
                                } else {
                                  setBulkConfig(prev => ({
                                    ...prev,
                                    tones: prev.tones.filter(t => t !== tone.value)
                                  }));
                                }
                              }}
                            />
                            <span className="text-sm">{tone.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="diversityLevel">Content Diversity</Label>
                      <Select
                        value={bulkConfig.diversityLevel}
                        onValueChange={(value) => setBulkConfig(prev => ({ ...prev, diversityLevel: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low - Similar content structure</SelectItem>
                          <SelectItem value="medium">Medium - Moderate variation</SelectItem>
                          <SelectItem value="high">High - Maximum content variety</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="keywordRotation"
                        checked={bulkConfig.keywordRotation}
                        onChange={(e) => setBulkConfig(prev => ({ ...prev, keywordRotation: e.target.checked }))}
                      />
                      <Label htmlFor="keywordRotation">Rotate keywords across posts</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includeImages"
                        checked={bulkConfig.includeImages}
                        onChange={(e) => setBulkConfig(prev => ({ ...prev, includeImages: e.target.checked }))}
                      />
                      <Label htmlFor="includeImages">Generate AI images for posts</Label>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bulk Preview and Actions */}
              <div className="space-y-6">
                {/* Prerequisites Check */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Prerequisites
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      {aiSettings.businessName ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">Business name set</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.target_keywords && formData.target_keywords.length > 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">Target keywords set</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {bulkConfig.campaignName ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">Campaign name set</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {bulkConfig.startDate && bulkConfig.endDate ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">Date range set</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Campaign Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Campaign Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <strong>Campaign:</strong> {bulkConfig.campaignName || 'Not set'}
                    </div>
                    <div className="text-sm">
                      <strong>Duration:</strong> {bulkConfig.startDate && bulkConfig.endDate ?
                        `${bulkConfig.startDate} to ${bulkConfig.endDate}` : 'Not set'}
                    </div>
                    <div className="text-sm">
                      <strong>Total Posts:</strong> {bulkConfig.totalPosts}
                    </div>
                    <div className="text-sm">
                      <strong>Posts/Day:</strong> {bulkConfig.postsPerDay}
                    </div>
                    <div className="text-sm">
                      <strong>Platforms:</strong> {bulkConfig.platforms.length}
                    </div>
                    <div className="text-sm">
                      <strong>Keywords:</strong> {formData.target_keywords?.length || 0}
                    </div>
                    {bulkConfig.includeImages && (
                      <div className="text-sm text-blue-600">
                        + AI image generation included
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Create Button */}
                <Card>
                  <CardContent className="pt-6">
                    <Button
                      onClick={createBulkPosts}
                      disabled={bulkGenerating || !aiSettings.businessName || !formData.target_keywords?.length || !bulkConfig.campaignName || !bulkConfig.startDate || !bulkConfig.endDate}
                      className="w-full"
                      size="lg"
                    >
                      {bulkGenerating ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          Creating {bulkConfig.totalPosts} Posts...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 mr-2" />
                          Create Bulk Campaign
                        </>
                      )}
                    </Button>

                    {bulkConfig.includeImages && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Estimated time: {Math.ceil(bulkConfig.totalPosts * 0.5)} minutes
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Results */}
                {bulkResults && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Campaign Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <strong>Campaign ID:</strong> {bulkResults.campaignId}
                      </div>
                      <div className="text-sm">
                        <strong>Posts Created:</strong> {bulkResults.postsCreated}
                      </div>
                      <div className="text-sm">
                        <strong>Posts Scheduled:</strong> {bulkResults.postsScheduled}
                      </div>
                      {bulkResults.errors && bulkResults.errors.length > 0 && (
                        <div className="text-sm text-red-600">
                          <strong>Errors:</strong> {bulkResults.errors.length}
                        </div>
                      )}
                      <Button
                        onClick={() => setSelectedTab("manage")}
                        variant="outline"
                        className="w-full"
                      >
                        View Created Posts
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Keyword Research */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Keyword Research & Clustering
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="seedKeywords">Seed Keywords *</Label>
                      <Textarea
                        id="seedKeywords"
                        value={seedKeywords}
                        onChange={(e) => setSeedKeywords(e.target.value)}
                        placeholder="Enter keywords separated by commas (e.g., plumber, emergency plumbing, water heater repair)"
                        rows={3}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Enter 1-5 seed keywords related to your business
                      </p>
                    </div>

                    <Button
                      onClick={performKeywordResearch}
                      disabled={keywordResearchLoading || !seedKeywords.trim()}
                      className="w-full"
                    >
                      {keywordResearchLoading ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          Researching Keywords...
                        </>
                      ) : (
                        <>
                          <Target className="h-4 w-4 mr-2" />
                          Research Keywords
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Keyword Clusters Results */}
                {keywordClusters.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Keyword Clusters ({keywordClusters.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {keywordClusters.map((cluster) => (
                          <div key={cluster.id} className="border rounded-lg p-4 hover:bg-muted/50">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-semibold text-lg">{cluster.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  Primary: {cluster.primary_keyword}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => useKeywordCluster(cluster)}
                              >
                                Use Keywords
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                              <div className="text-center">
                                <div className="text-lg font-bold">{cluster.total_search_volume.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Total Volume</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold">{cluster.avg_difficulty}/100</div>
                                <div className="text-xs text-muted-foreground">Avg Difficulty</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold">${cluster.avg_cpc}</div>
                                <div className="text-xs text-muted-foreground">Avg CPC</div>
                              </div>
                              <div className="text-center">
                                <Badge variant={
                                  cluster.search_intent === 'transactional' ? 'default' :
                                  cluster.search_intent === 'commercial' ? 'secondary' :
                                  'outline'
                                }>
                                  {cluster.search_intent}
                                </Badge>
                              </div>
                            </div>

                            <div className="mb-3">
                              <h4 className="font-medium text-sm mb-2">Keywords ({cluster.keywords.length})</h4>
                              <div className="flex flex-wrap gap-1">
                                {cluster.keywords.slice(0, 8).map((keyword) => (
                                  <Badge key={keyword.keyword} variant="outline" className="text-xs">
                                    {keyword.keyword} ({keyword.search_volume})
                                  </Badge>
                                ))}
                                {cluster.keywords.length > 8 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{cluster.keywords.length - 8} more
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-sm mb-2">Content Opportunities</h4>
                              <ul className="text-sm text-muted-foreground space-y-1">
                                {cluster.content_opportunities.slice(0, 3).map((opportunity, index) => (
                                  <li key={index} className="flex items-center gap-2">
                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                    {opportunity}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Keyword Research Guide */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <strong>1. Enter Seed Keywords</strong>
                      <p className="text-muted-foreground">Start with 1-5 keywords related to your business</p>
                    </div>
                    <div className="text-sm">
                      <strong>2. Get Clusters</strong>
                      <p className="text-muted-foreground">We group related keywords with search data</p>
                    </div>
                    <div className="text-sm">
                      <strong>3. Apply to Posts</strong>
                      <p className="text-muted-foreground">Use keyword clusters for targeted content</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Understanding Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <strong>Search Volume:</strong> Monthly searches
                    </div>
                    <div className="text-sm">
                      <strong>Difficulty:</strong> How hard to rank (0-100)
                    </div>
                    <div className="text-sm">
                      <strong>CPC:</strong> Cost per click in ads
                    </div>
                    <div className="text-sm">
                      <strong>Intent:</strong> What users want
                      <ul className="mt-1 ml-4 text-xs text-muted-foreground">
                        <li>• Informational: Learning</li>
                        <li>• Commercial: Comparing</li>
                        <li>• Transactional: Buying</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Manage Posts Tab */}
          <TabsContent value="manage" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Manage Posts
                  </div>
                  <Button onClick={loadPosts} size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading posts...</p>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No posts yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first social media post to get started.</p>
                    <Button onClick={() => setSelectedTab("create")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Post
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => {
                      const Icon = PLATFORM_ICONS[post.platform];
                      return (
                        <div key={post.id} className="border rounded-lg p-4 hover:bg-muted/50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Icon className="h-4 w-4" />
                                <span className="font-medium">{post.title}</span>
                                <Badge variant={
                                  post.status === 'published' ? 'default' :
                                  post.status === 'scheduled' ? 'secondary' :
                                  post.status === 'failed' ? 'destructive' :
                                  'outline'
                                }>
                                  {post.status}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {post.content}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{PLATFORM_NAMES[post.platform]}</span>
                                <span>{post.content_length} characters</span>
                                {post.scheduled_for && (
                                  <span>
                                    <Clock className="h-3 w-3 inline mr-1" />
                                    {new Date(post.scheduled_for).toLocaleDateString()}
                                  </span>
                                )}
                                {post.syndicated_to && post.syndicated_to.length > 0 && (
                                  <span>
                                    <Share2 className="h-3 w-3 inline mr-1" />
                                    Syndicated to {post.syndicated_to.length} platforms
                                  </span>
                                )}
                              </div>

                              {/* Engagement metrics */}
                              {post.status === 'published' && (
                                <div className="flex items-center gap-4 mt-2 text-xs">
                                  <span>{post.likes_count || 0} likes</span>
                                  <span>{post.comments_count || 0} comments</span>
                                  <span>{post.shares_count || 0} shares</span>
                                  {post.engagement_rate && (
                                    <span>{post.engagement_rate}% engagement</span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {post.status === 'draft' && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">
                                      <Share2 className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Syndicate Post</DialogTitle>
                                      <DialogDescription>
                                        Select platforms to syndicate this post to
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <Label>Target Platforms</Label>
                                        <div className="space-y-2 mt-2">
                                          {Object.entries(PLATFORM_NAMES)
                                            .filter(([key]) => key !== post.platform)
                                            .filter(([key]) => !post.syndicated_to?.includes(key))
                                            .map(([key, name]) => {
                                              const Icon = PLATFORM_ICONS[key as keyof typeof PLATFORM_ICONS];
                                              return (
                                                <label key={key} className="flex items-center space-x-2 cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={syndicationSettings.targetPlatforms.includes(key)}
                                                    onChange={(e) => {
                                                      if (e.target.checked) {
                                                        setSyndicationSettings(prev => ({
                                                          ...prev,
                                                          targetPlatforms: [...prev.targetPlatforms, key]
                                                        }));
                                                      } else {
                                                        setSyndicationSettings(prev => ({
                                                          ...prev,
                                                          targetPlatforms: prev.targetPlatforms.filter(p => p !== key)
                                                        }));
                                                      }
                                                    }}
                                                  />
                                                  <Icon className="h-4 w-4" />
                                                  <span>{name}</span>
                                                </label>
                                              );
                                            })}
                                        </div>
                                      </div>
                                      <Button 
                                        onClick={() => post.id && syndicatePost(post.id)}
                                        disabled={syndicationSettings.targetPlatforms.length === 0}
                                        className="w-full"
                                      >
                                        Syndicate Post
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                              
                              <Button size="sm" variant="outline">
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => post.id && deletePost(post.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Post Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Analytics Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Detailed analytics and insights for your social media posts will be available here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

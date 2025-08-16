// @ts-nocheck - Temporary suppression of type errors
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Search,
  BookOpen,
  Users,
  Building2,
  Settings,
  Camera,
  FolderOpen,
  MessageSquare,
  CreditCard,
  BarChart3,
  Shield,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Star,
  Clock,
  User,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Eye,
  Calendar,
} from "lucide-react";
import { useState } from "react";

interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  userType: "all" | "business" | "agency" | "admin";
  content: string;
  tags: string[];
  lastUpdated: string;
  popular?: boolean;
  views?: number;
  rating?: number;
  status: "published" | "draft" | "archived";
}

export default function SuperAdminHelp() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [newArticle, setNewArticle] = useState({
    title: "",
    description: "",
    category: "",
    userType: "all" as const,
    content: "",
    tags: "",
  });

  const categories = [
    { id: "getting-started", name: "Getting Started", icon: BookOpen },
    { id: "account", name: "Account Management", icon: User },
    { id: "business", name: "Business Management", icon: Building2 },
    { id: "agency", name: "Agency Features", icon: Users },
    { id: "photos", name: "Photo Management", icon: Camera },
    { id: "projects", name: "Project Management", icon: FolderOpen },
    { id: "reviews", name: "Review Management", icon: MessageSquare },
    { id: "billing", name: "Billing & Subscriptions", icon: CreditCard },
    { id: "analytics", name: "Analytics & Reports", icon: BarChart3 },
    { id: "security", name: "Security & Privacy", icon: Shield },
    { id: "support", name: "Support & Troubleshooting", icon: HelpCircle },
    { id: "api", name: "API & Integrations", icon: Settings },
  ];

  const articles: Article[] = [
    {
      id: "getting-started-guide",
      title: "Getting Started with the Platform",
      description: "A comprehensive guide to help you get started quickly",
      category: "getting-started",
      userType: "all",
      status: "published",
      content: `
# Getting Started with the Platform

Welcome to our comprehensive business management platform! This guide will help you get up and running quickly.

## What You Can Do

Our platform helps you:
- **Manage Your Business Profile**: Keep your business information up-to-date
- **Handle Customer Reviews**: Respond to and manage customer feedback
- **Organize Photos**: Upload and organize your business photos
- **Track Projects**: Manage ongoing projects and tasks
- **View Analytics**: Get insights into your business performance

## First Steps

### 1. Complete Your Profile
Make sure your business profile is complete:
- Business name and description
- Contact information
- Address and hours
- Business category

### 2. Upload Photos
Add high-quality photos of your business:
- Exterior and interior shots
- Products or services
- Team photos
- Customer experiences

### 3. Set Up Projects
Organize your work with projects:
- Create project categories
- Set up project templates
- Invite team members
- Track progress

### 4. Configure Settings
Customize your experience:
- Notification preferences
- Privacy settings
- Integration options
- User permissions

## Need Help?

If you need assistance:
- Check our FAQ section
- Contact support through the help desk
- Join our community forum
- Schedule a training session
      `,
      tags: ["getting-started", "setup", "basics"],
      lastUpdated: "2024-01-20",
      popular: true,
      views: 1250,
      rating: 4.8,
    },
    {
      id: "photo-management",
      title: "Photo Management Best Practices",
      description: "Learn how to organize and optimize your business photos",
      category: "photos",
      userType: "all",
      status: "published",
      content: `
# Photo Management Best Practices

High-quality photos are crucial for your business success. This guide covers best practices for managing your photo library.

## Photo Organization

### Categories
Organize photos into clear categories:
- **Exterior**: Building facades, signage, parking
- **Interior**: Dining areas, workspaces, amenities
- **Products**: Individual items, displays, packaging
- **Services**: Work in progress, completed projects
- **Team**: Staff photos, behind-the-scenes
- **Events**: Special occasions, promotions

### Naming Convention
Use descriptive, consistent naming:
- Include date: "2024-01-20-exterior-storefront.jpg"
- Add location: "main-dining-room-overview.jpg"
- Specify purpose: "holiday-promotion-banner.jpg"

## Quality Guidelines

### Technical Requirements
- **Resolution**: Minimum 1920x1080 for web display
- **Format**: JPEG for photos, PNG for graphics with transparency
- **File Size**: Optimize for web (under 2MB per image)
- **Aspect Ratio**: 16:9 for headers, 4:3 for general use

### Photography Tips
1. **Lighting**: Use natural light when possible
2. **Composition**: Follow rule of thirds
3. **Focus**: Ensure sharp, clear images
4. **Background**: Keep backgrounds clean and uncluttered
5. **Consistency**: Maintain similar style across photos

## Photo Management Tools

### Uploading
- **Bulk Upload**: Select multiple files at once
- **Drag and Drop**: Simple interface for quick uploads
- **Mobile App**: Upload directly from your phone
- **Auto-Sync**: Connect cloud storage for automatic updates

### Editing
- **Basic Adjustments**: Brightness, contrast, saturation
- **Cropping**: Adjust composition and aspect ratio
- **Filters**: Apply consistent styling
- **Text Overlay**: Add captions or branding

### Organization
- **Tags**: Add searchable keywords
- **Albums**: Group related photos
- **Favorites**: Mark best photos for easy access
- **Archive**: Store older photos without deleting
      `,
      tags: ["photos", "organization", "quality", "tips"],
      lastUpdated: "2024-01-18",
      views: 890,
      rating: 4.6,
    },
    {
      id: "review-management",
      title: "Managing Customer Reviews",
      description:
        "Best practices for responding to and managing customer reviews",
      category: "reviews",
      userType: "business",
      status: "published",
      content: `
# Managing Customer Reviews

Customer reviews are crucial for your business reputation. Learn how to effectively manage and respond to reviews.

## Review Response Strategy

### Positive Reviews
**Thank customers promptly**:
- Respond within 24-48 hours
- Personalize your response
- Mention specific details they shared
- Invite them to return

**Example Response**:
"Thank you so much for your wonderful review, Sarah! We're thrilled you enjoyed our pasta special and found our staff welcoming. We can't wait to serve you again soon!"

### Negative Reviews
**Address concerns professionally**:
- Acknowledge their experience
- Apologize sincerely if appropriate
- Offer to resolve the issue
- Take conversation offline when needed

**Example Response**:
"We're sorry to hear about your experience, John. This doesn't reflect our usual standards. Please contact us directly at [phone] so we can make this right."

## Review Management Tools

### Dashboard Features
- **Review Monitoring**: Track all reviews in one place
- **Response Templates**: Save time with pre-written responses
- **Sentiment Analysis**: Understand review trends
- **Alert System**: Get notified of new reviews

### Response Workflow
1. **Review Alert**: Receive notification of new review
2. **Assessment**: Evaluate sentiment and urgency
3. **Response**: Craft appropriate response
4. **Follow-up**: Monitor for customer response
5. **Analysis**: Learn from feedback patterns

## Best Practices

### Do's
- ✅ Respond to all reviews, positive and negative
- ✅ Keep responses professional and friendly
- ✅ Use the customer's name when possible
- ✅ Address specific points mentioned
- ✅ Invite customers to return or contact you

### Don'ts
- ❌ Argue with customers publicly
- ❌ Share personal information
- ❌ Copy and paste generic responses
- ❌ Ignore negative feedback
- ❌ Get emotional or defensive

## Encouraging Reviews

### Ask at the Right Time
- After positive interactions
- Following successful project completion
- During checkout or payment
- In follow-up communications

### Make It Easy
- Provide direct links to review platforms
- Include review requests in email signatures
- Create QR codes for physical locations
- Offer incentives (where appropriate)
      `,
      tags: ["reviews", "reputation", "customer-service", "response"],
      lastUpdated: "2024-01-15",
      views: 1100,
      rating: 4.7,
    },
    {
      id: "agency-onboarding",
      title: "Agency Client Onboarding Guide",
      description: "Step-by-step process for onboarding new business clients",
      category: "agency",
      userType: "agency",
      status: "published",
      content: `
# Agency Client Onboarding Guide

Successfully onboarding new clients is crucial for agency success. This guide covers the complete process.

## Pre-Onboarding Preparation

### Agency Setup
1. **Complete Agency Profile**: Ensure your agency information is complete
2. **Set Service Packages**: Define your service offerings
3. **Prepare Documentation**: Create onboarding materials
4. **Set Up Billing**: Configure payment processing

### Client Requirements
- Valid business information
- Google My Business account access
- Business photos and content
- Contact information for key stakeholders

## Onboarding Steps

### Step 1: Initial Client Setup
1. **Navigate to Business Owners**: Go to /agency/admin/business-owners
2. **Add New Client**: Click "Add Business Owner"
3. **Enter Business Details**:
   - Business name and description
   - Contact information
   - Address and location details
   - Industry and business type

### Step 2: Account Configuration
1. **Set Permissions**: Define what the client can access
2. **Configure Services**: Select service packages
3. **Set Up Billing**: Choose subscription plan
4. **Create Login Credentials**: Set up client access

### Step 3: Integration Setup
1. **Google My Business**: Connect client's GMB account
2. **Social Media**: Link relevant social platforms
3. **Analytics**: Set up tracking and reporting
4. **Custom Integrations**: Configure any specific tools

### Step 4: Training and Support
1. **Initial Training**: Schedule onboarding call
2. **Provide Documentation**: Share relevant guides
3. **Set Expectations**: Clarify roles and responsibilities
4. **Ongoing Support**: Establish communication channels

## Managing Client Relationships

### Communication
- Regular check-ins and updates
- Clear reporting schedules
- Responsive support channels
- Transparent billing and invoicing

### Service Delivery
- Monitor client performance metrics
- Provide regular reports and insights
- Proactive recommendations
- Quality assurance processes

### Account Management
- Track client satisfaction
- Identify upselling opportunities
- Handle contract renewals
- Manage service changes

## Best Practices

1. **Standardize Process**: Use consistent onboarding steps
2. **Document Everything**: Keep detailed client records
3. **Set Clear Expectations**: Define scope and deliverables
4. **Regular Reviews**: Schedule periodic account reviews
5. **Continuous Improvement**: Gather feedback and optimize
      `,
      tags: ["onboarding", "clients", "agency", "process"],
      lastUpdated: "2024-01-15",
      views: 650,
      rating: 4.5,
    },
    {
      id: "common-issues",
      title: "Common Issues and Solutions",
      description: "Quick fixes for the most frequently encountered problems",
      category: "support",
      userType: "all",
      status: "published",
      content: `
# Common Issues and Solutions

This guide covers the most frequently encountered issues and their solutions.

## Login and Authentication Issues

### Can't Log In
**Problem**: Unable to access your account
**Solutions**:
1. **Check Credentials**: Verify email and password
2. **Reset Password**: Use the "Forgot Password" link
3. **Clear Browser Cache**: Clear cookies and cached data
4. **Try Different Browser**: Test with another browser

### Two-Factor Authentication Issues
**Problem**: Not receiving 2FA codes
**Solutions**:
1. **Check Time Sync**: Ensure device time is accurate
2. **Backup Codes**: Use saved backup codes
3. **Contact Support**: Request 2FA reset if needed

## Photo Upload Issues

### Upload Fails
**Problem**: Photos won't upload
**Solutions**:
1. **Check File Size**: Ensure files are under 10MB
2. **Supported Formats**: Use JPEG, PNG, or WebP
3. **Internet Connection**: Verify stable connection
4. **Browser Update**: Use latest browser version

### Slow Upload Speed
**Problem**: Uploads taking too long
**Solutions**:
1. **Compress Images**: Reduce file size before upload
2. **Batch Uploads**: Upload fewer files at once
3. **Peak Hours**: Try uploading during off-peak times
4. **Browser Cache**: Clear cache and try again

## Project Management Issues

### Can't Create Projects
**Problem**: Unable to create new projects
**Solutions**:
1. **Check Permissions**: Verify you have project creation rights
2. **Subscription Limits**: Check if you've reached project limits
3. **Required Fields**: Ensure all required fields are filled
4. **Browser Issues**: Try refreshing page or different browser

### Missing Project Data
**Problem**: Project information disappeared
**Solutions**:
1. **Check Filters**: Remove any active filters
2. **Archive Status**: Check if project was archived
3. **Permissions**: Verify you still have access
4. **Contact Support**: Report data loss immediately

## Performance Issues

### Slow Loading
**Problem**: Pages load slowly
**Solutions**:
1. **Clear Cache**: Clear browser cache and cookies
2. **Internet Speed**: Test connection speed
3. **Extensions**: Disable browser extensions temporarily
4. **Peak Usage**: Try during off-peak hours

### Error Messages
**Problem**: Getting error messages
**Solutions**:
1. **Screenshot Errors**: Capture error details
2. **Browser Console**: Check for console errors
3. **Different Browser**: Test with another browser
4. **Contact Support**: Report with error details

## Getting Additional Help

If these solutions don't resolve your issue:
1. **Contact Support**: Use the support ticket system
2. **Check Status Page**: Verify system status
3. **Community Forum**: Ask the community
4. **Live Chat**: Available during business hours
      `,
      tags: ["troubleshooting", "issues", "solutions", "support"],
      lastUpdated: "2024-01-12",
      views: 2100,
      rating: 4.4,
    },
  ];

  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesCategory =
      selectedCategory === "all" || article.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const popularArticles = articles.filter((article) => article.popular);
  const recentArticles = articles
    .sort(
      (a, b) =>
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
    )
    .slice(0, 5);

  const handleCreateArticle = () => {
    // In real implementation, this would make an API call
    console.log("Creating article:", newArticle);
    setShowCreateDialog(false);
    setNewArticle({
      title: "",
      description: "",
      category: "",
      userType: "all",
      content: "",
      tags: "",
    });
  };

  const handleEditArticle = (article: Article) => {
    setEditingArticle(article);
    setNewArticle({
      title: article.title,
      description: article.description,
      category: article.category,
      userType: article.userType,
      content: article.content,
      tags: article.tags.join(", "),
    });
    setShowCreateDialog(true);
  };

  const handleSaveEdit = () => {
    // In real implementation, this would make an API call
    console.log("Updating article:", editingArticle?.id, newArticle);
    setShowCreateDialog(false);
    setEditingArticle(null);
    setNewArticle({
      title: "",
      description: "",
      category: "",
      userType: "all",
      content: "",
      tags: "",
    });
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-full overflow-x-hidden">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Help Center Management</h1>
              <p className="text-muted-foreground">
                Create and manage help articles and documentation
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Article
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingArticle ? "Edit Article" : "Create New Article"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingArticle
                      ? "Update the article information below."
                      : "Fill in the details to create a new help article."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newArticle.title}
                        onChange={(e) =>
                          setNewArticle((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Article title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={newArticle.category}
                        onValueChange={(value) =>
                          setNewArticle((prev) => ({
                            ...prev,
                            category: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="userType">User Type</Label>
                      <Select
                        value={newArticle.userType}
                        onValueChange={(value: any) =>
                          setNewArticle((prev) => ({
                            ...prev,
                            userType: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="business">
                            Business Owners
                          </SelectItem>
                          <SelectItem value="agency">Agency Admins</SelectItem>
                          <SelectItem value="admin">Super Admins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="tags">Tags (comma separated)</Label>
                      <Input
                        id="tags"
                        value={newArticle.tags}
                        onChange={(e) =>
                          setNewArticle((prev) => ({
                            ...prev,
                            tags: e.target.value,
                          }))
                        }
                        placeholder="getting-started, setup, basics"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newArticle.description}
                      onChange={(e) =>
                        setNewArticle((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Brief description of the article"
                    />
                  </div>
                  <div>
                    <Label htmlFor="content">Content (Markdown)</Label>
                    <Textarea
                      id="content"
                      value={newArticle.content}
                      onChange={(e) =>
                        setNewArticle((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      placeholder="Write your article content in Markdown format..."
                      rows={15}
                      className="font-mono"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      setEditingArticle(null);
                      setNewArticle({
                        title: "",
                        description: "",
                        category: "",
                        userType: "all",
                        content: "",
                        tags: "",
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={
                      editingArticle ? handleSaveEdit : handleCreateArticle
                    }
                  >
                    {editingArticle ? "Save Changes" : "Create Article"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search articles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Articles
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{articles.length}</div>
                <p className="text-xs text-muted-foreground">
                  {articles.filter((a) => a.status === "published").length}{" "}
                  published
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Views
                </CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {articles
                    .reduce((sum, article) => sum + (article.views || 0), 0)
                    .toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all articles
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Rating
                </CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(
                    articles.reduce(
                      (sum, article) => sum + (article.rating || 0),
                      0,
                    ) / articles.length
                  ).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">
                  User satisfaction
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Categories
                </CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{categories.length}</div>
                <p className="text-xs text-muted-foreground">
                  Available topics
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="browse" className="space-y-6">
            <TabsList>
              <TabsTrigger value="browse">Browse Articles</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="space-y-6">
              <div className="grid gap-6">
                {filteredArticles.map((article) => (
                  <Card
                    key={article.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg hover:text-primary cursor-pointer">
                              {article.title}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">
                              {categories.find((c) => c.id === article.category)
                                ?.name || article.category}
                            </Badge>
                            <Badge
                              variant={
                                article.status === "published"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {article.status}
                            </Badge>
                          </div>
                          <CardDescription>
                            {article.description}
                          </CardDescription>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {article.views?.toLocaleString() || 0} views
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4" />
                              {article.rating || 0} rating
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Updated{" "}
                              {new Date(
                                article.lastUpdated,
                              ).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEditArticle(article)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Article
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {article.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="popular" className="space-y-6">
              <div className="grid gap-6">
                {popularArticles.map((article) => (
                  <Card
                    key={article.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg hover:text-primary cursor-pointer">
                              {article.title}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">
                              {categories.find((c) => c.id === article.category)
                                ?.name || article.category}
                            </Badge>
                            <Badge className="text-xs bg-yellow-100 text-yellow-800">
                              Popular
                            </Badge>
                          </div>
                          <CardDescription>
                            {article.description}
                          </CardDescription>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {article.views?.toLocaleString() || 0} views
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4" />
                              {article.rating || 0} rating
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditArticle(article)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="recent" className="space-y-6">
              <div className="grid gap-6">
                {recentArticles.map((article) => (
                  <Card
                    key={article.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg hover:text-primary cursor-pointer">
                              {article.title}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">
                              {categories.find((c) => c.id === article.category)
                                ?.name || article.category}
                            </Badge>
                          </div>
                          <CardDescription>
                            {article.description}
                          </CardDescription>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Updated{" "}
                              {new Date(
                                article.lastUpdated,
                              ).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditArticle(article)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="categories" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => {
                  const categoryArticles = articles.filter(
                    (a) => a.category === category.id,
                  );
                  const Icon = category.icon;
                  return (
                    <Card
                      key={category.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Icon className="h-8 w-8 text-primary" />
                          <div>
                            <CardTitle className="text-lg">
                              {category.name}
                            </CardTitle>
                            <CardDescription>
                              {categoryArticles.length} articles
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          {categoryArticles
                            .reduce(
                              (sum, article) => sum + (article.views || 0),
                              0,
                            )
                            .toLocaleString()}{" "}
                          total views
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SuperAdminLayout>
  );
}

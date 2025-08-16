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
import { AppLayout } from "@/components/AppLayout";
import { AgencyAdminLayout } from "@/components/AgencyAdminLayout";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
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
  Upload,
  Image,
  File,
  Video,
  AlertTriangle,
  CheckCircle,
  Paperclip,
  RefreshCw,
  Download,
  Bug,
  Activity,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { formatTableDate } from "@/lib/dateUtils";
import { toast } from "sonner";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  userType: "all" | "admin" | "agency" | "super-admin";
  content: string;
  tags: string[];
  lastUpdated: string;
  popular?: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon: any;
  userType: "all" | "admin" | "agency" | "super-admin";
}

interface SupportTicket {
  id: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  description: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  assignedTo?: string;
  attachments: string[];
}

export default function KnowledgeBase() {
  const currentUser = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuper = isSuperAdmin();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showSupportTickets, setShowSupportTickets] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [newTicket, setNewTicket] = useState({
    title: "",
    category: "",
    priority: "medium" as const,
    description: "",
  });

  // Determine which layout to use based on current path or user role
  const getLayoutComponent = () => {
    if (location.pathname.startsWith("/super-admin")) {
      return SuperAdminLayout;
    }
    if (location.pathname.startsWith("/agency")) {
      return AgencyAdminLayout;
    }
    return AppLayout;
  };

  const LayoutComponent = getLayoutComponent();

  const categories: Category[] = [
    {
      id: "getting-started",
      name: "Getting Started",
      description: "Learn the basics and get up and running quickly",
      icon: BookOpen,
      userType: "all",
    },
    {
      id: "projects",
      name: "Project Management",
      description: "Managing projects, photos, and documentation",
      icon: FolderOpen,
      userType: "admin",
    },
    {
      id: "agency-management",
      name: "Agency Management",
      description: "Managing clients, billing, and agency operations",
      icon: Building2,
      userType: "agency",
    },
    {
      id: "system-admin",
      name: "System Administration",
      description: "Advanced system configuration and management",
      icon: Shield,
      userType: "super-admin",
    },
    {
      id: "billing-payments",
      name: "Billing & Payments",
      description: "Understanding pricing, payments, and subscriptions",
      icon: CreditCard,
      userType: "all",
    },
    {
      id: "support",
      name: "Support & Troubleshooting",
      description: "Get help when you need it most",
      icon: MessageSquare,
      userType: "all",
    },
  ];

  const articles: Article[] = [
    // Getting Started
    {
      id: "welcome",
      title: "Welcome to GMB Booster",
      description: "Your complete guide to getting started with the platform",
      category: "getting-started",
      userType: "all",
      content: `
# Welcome to GMB Booster

GMB Booster is a comprehensive platform designed to help businesses manage their Google My Business presence effectively. Whether you're a business owner, agency, or system administrator, this guide will help you get started.

## What is GMB Booster?

GMB Booster helps you:
- Manage multiple business locations
- Optimize your Google My Business listings
- Track performance and analytics
- Manage photos and content
- Handle customer reviews and responses

## Quick Start Guide

### For Business Owners
1. **Create Your Account**: Sign up and verify your business
2. **Add Your Business**: Connect your Google My Business account
3. **Upload Photos**: Add high-quality photos of your business
4. **Manage Projects**: Track improvements and updates
5. **Monitor Performance**: View analytics and insights

### For Agencies
1. **Set Up Your Agency**: Configure your agency profile
2. **Add Clients**: Onboard your business owner clients
3. **Manage Multiple Locations**: Handle multiple client accounts
4. **Generate Reports**: Create performance reports for clients
5. **Billing Management**: Track subscriptions and payments

### For System Administrators
1. **System Overview**: Understand the platform architecture
2. **User Management**: Manage user access and permissions
3. **Agency Management**: Oversee agency operations
4. **System Settings**: Configure global settings
5. **Monitoring**: Track system performance and usage

## Need Help?

- Browse our knowledge base for detailed guides
- Contact support for technical assistance
- Join our community for tips and best practices
      `,
      tags: ["welcome", "getting-started", "overview"],
      lastUpdated: "2024-03-15",
      popular: true,
    },
    {
      id: "first-login",
      title: "Your First Login",
      description:
        "Step-by-step guide for your first time accessing the platform",
      category: "getting-started",
      userType: "all",
      content: `
# Your First Login

This guide will walk you through your first login experience and help you navigate the platform.

## Accessing Your Account

1. **Navigate to the Login Page**: Go to the GMB Booster login page
2. **Enter Your Credentials**: Use the email and password provided during signup
3. **Two-Factor Authentication**: If enabled, enter your verification code

## Dashboard Overview

After logging in, you'll be taken to your dashboard:

### Business Owner Dashboard (/admin/projects)
- **Projects**: View and manage all your business projects
- **Gallery**: Manage photos and media for your listings
- **Settings**: Configure your business preferences
- **Support**: Get help when you need it

### Agency Dashboard (/agency/admin/dashboard)
- **Client Management**: Overview of all your clients
- **Analytics**: Performance metrics across all clients
- **Billing**: Subscription and payment management
- **Business Owners**: Manage your client relationships

### Super Admin Dashboard (/super-admin)
- **System Overview**: Platform-wide statistics
- **User Management**: Manage all platform users
- **Agency Management**: Oversee agency operations
- **System Settings**: Configure global platform settings

## Navigation Tips

- Use the left sidebar to navigate between sections
- Your profile information is displayed in the bottom-left corner
- Quick actions are available in the top header
- Use breadcrumbs to understand your current location

## Next Steps

1. **Complete Your Profile**: Add your business information
2. **Connect Integrations**: Link your Google My Business account
3. **Explore Features**: Try creating your first project or client
4. **Customize Settings**: Adjust preferences to match your workflow
      `,
      tags: ["login", "dashboard", "navigation", "first-time"],
      lastUpdated: "2024-03-15",
    },

    // Project Management (Admin)
    {
      id: "creating-projects",
      title: "Creating and Managing Projects",
      description:
        "Learn how to create, organize, and track your business projects",
      category: "projects",
      userType: "admin",
      content: `
# Creating and Managing Projects

Projects in GMB Booster help you track improvements, updates, and changes to your business listings and locations.

## Creating a New Project

1. **Navigate to Projects**: Go to /admin/projects
2. **Click "New Project"**: Use the button in the sidebar or header
3. **Fill Project Details**:
   - **Project Name**: Give your project a descriptive name
   - **Description**: Explain what this project involves
   - **Address**: Specify the location for this project
   - **Customer Phone**: Add contact information
   - **Keywords**: Tag your project for easy searching

4. **Upload Photos**: Add before/during/after photos
5. **Set Timeline**: Add start and completion dates
6. **Assign Tasks**: Create a checklist of items to complete

## Project Organization

### Using Keywords/Tags
- Add relevant keywords to make projects searchable
- Use consistent tags across similar projects
- Common tags: "kitchen", "bathroom", "renovation", "maintenance"

### Project Status
- **Active**: Currently in progress
- **Completed**: Finished projects
- **On Hold**: Temporarily paused
- **Archived**: Old projects kept for reference

### Photo Management
- Upload high-quality photos (JPG, PNG, WebP)
- Tag photos with relevant keywords
- Set a primary photo for each project
- Organize photos by date and category

## Project Features

### Task Management
- Create checklists for project milestones
- Mark tasks as complete
- Add notes and updates to tasks
- Track progress over time

### Notes and Documentation
- Add detailed notes about project progress
- Upload documents and files
- Keep communication records
- Track changes and updates

### Activity Log
- Automatic tracking of all project changes
- See who made what changes and when
- Filter activity by date or type
- Export activity reports

## Best Practices

1. **Consistent Naming**: Use clear, descriptive project names
2. **Regular Updates**: Keep project status current
3. **Photo Quality**: Upload high-resolution images
4. **Documentation**: Maintain detailed notes and records
5. **Keywords**: Use consistent tagging for easy searching
      `,
      tags: ["projects", "creation", "management", "organization"],
      lastUpdated: "2024-03-15",
      popular: true,
    },

    // Agency Management
    {
      id: "client-onboarding",
      title: "Client Onboarding Process",
      description: "How to onboard new business owner clients to your agency",
      category: "agency-management",
      userType: "agency",
      content: `
# Client Onboarding Process

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
      lastUpdated: "2024-03-15",
      popular: true,
    },

    // Support & Troubleshooting
    {
      id: "common-issues",
      title: "Common Issues and Solutions",
      description: "Quick fixes for the most frequently encountered problems",
      category: "support",
      userType: "all",
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
5. **Contact Support**: If issues persist

### Two-Factor Authentication Problems
**Problem**: Not receiving verification codes
**Solutions**:
1. **Check Phone Number**: Ensure correct number is registered
2. **Check Spam Folder**: Look for SMS/email in spam
3. **Try Alternative Method**: Use backup authentication method
4. **Regenerate Codes**: Request new backup codes

## Project and Data Issues

### Photos Not Uploading
**Problem**: Unable to upload images to projects
**Solutions**:
1. **Check File Size**: Ensure images are under size limit
2. **Verify Format**: Use supported formats (JPG, PNG, WebP)
3. **Stable Connection**: Ensure good internet connection
4. **Browser Settings**: Allow file uploads in browser
5. **Clear Cache**: Clear browser cache and cookies

### Data Not Saving
**Problem**: Changes aren't being saved
**Solutions**:
1. **Check Connection**: Verify internet connectivity
2. **Refresh Page**: Reload and try again
3. **Required Fields**: Ensure all required fields are filled
4. **Browser Compatibility**: Use supported browser version
5. **Contact Support**: For persistent issues

## Performance Issues

### Slow Loading
**Problem**: Platform loads slowly
**Solutions**:
1. **Check Internet**: Test your connection speed
2. **Close Tabs**: Reduce browser memory usage
3. **Clear Cache**: Clear browser cache and cookies
4. **Update Browser**: Use latest browser version
5. **Try Different Network**: Test on different connection

### Mobile Issues
**Problem**: Problems on mobile devices
**Solutions**:
1. **Update App**: Ensure you have latest version
2. **Restart Device**: Power cycle your device
3. **Clear App Data**: Clear app cache and data
4. **Check OS Version**: Ensure compatible OS version
5. **Use Browser**: Try mobile browser as alternative

## Integration Issues

### Google My Business Connection
**Problem**: Unable to connect GMB account
**Solutions**:
1. **Check Permissions**: Ensure proper GMB access
2. **Reauthorize**: Disconnect and reconnect account
3. **Update Credentials**: Verify Google account access
4. **Clear Tokens**: Reset authentication tokens
5. **Contact Support**: For advanced integration issues

## Getting Additional Help

### Self-Service Options
1. **Knowledge Base**: Search our help articles
2. **FAQ Section**: Check frequently asked questions
3. **Video Tutorials**: Watch step-by-step guides
4. **Community Forums**: Connect with other users

### Contact Support
1. **Support Tickets**: Create detailed support requests
2. **Live Chat**: Get real-time assistance
3. **Email Support**: Send detailed questions
4. **Phone Support**: Call for urgent issues

### Emergency Contacts
- **Technical Issues**: tech-support@gmbbooster.com
- **Billing Questions**: billing@gmbbooster.com
- **Account Access**: access-help@gmbbooster.com
- **Emergency Line**: 1-800-GMB-HELP
      `,
      tags: ["troubleshooting", "issues", "solutions", "support"],
      lastUpdated: "2024-03-15",
      popular: true,
    },

    // Billing & Payments
    {
      id: "subscription-plans",
      title: "Understanding Subscription Plans",
      description: "Overview of available plans and pricing options",
      category: "billing-payments",
      userType: "all",
      content: `
# Understanding Subscription Plans

GMB Booster offers flexible subscription plans to meet different business needs.

## Available Plans

### Starter Plan - $39/month
**Perfect for small businesses**
- Up to 5 admin users
- Basic project management
- Standard photo storage (10GB)
- Email support
- Core GMB integration

### Professional Plan - $49/month
**Ideal for growing businesses**
- Up to 15 admin users
- Advanced project management
- Extended photo storage (50GB)
- Priority support
- Advanced integrations
- Custom reporting

### Enterprise Plan - $99/month
**For large businesses and agencies**
- Unlimited admin users
- Full feature access
- Unlimited photo storage
- 24/7 phone support
- Custom integrations
- White-label options
- Dedicated account manager

## Plan Features Comparison

### User Management
- **Starter**: 5 users maximum
- **Professional**: 15 users maximum
- **Enterprise**: Unlimited users

### Storage Limits
- **Starter**: 10GB photo storage
- **Professional**: 50GB photo storage
- **Enterprise**: Unlimited storage

### Support Levels
- **Starter**: Email support (24-48h response)
- **Professional**: Priority support (12-24h response)
- **Enterprise**: 24/7 phone support (immediate response)

### Advanced Features
- **Starter**: Basic features only
- **Professional**: Advanced reporting, custom integrations
- **Enterprise**: All features, white-label, custom development

## Billing Information

### Payment Methods
- Credit/Debit Cards (Visa, MasterCard, American Express)
- PayPal
- Bank Transfer (Enterprise plans)
- Invoice Payment (Enterprise plans)

### Billing Cycles
- **Monthly**: Pay month-to-month with flexibility
- **Annual**: Save 20% with annual payment
- **Custom**: Enterprise plans can negotiate custom terms

### Currency Support
- US Dollar (USD)
- Euro (EUR)
- British Pound (GBP)
- Canadian Dollar (CAD)

## Managing Your Subscription

### Upgrading Plans
1. Go to Settings > Billing
2. Select "Change Plan"
3. Choose your new plan
4. Confirm upgrade
5. Changes take effect immediately

### Downgrading Plans
1. Go to Settings > Billing
2. Select "Change Plan"
3. Choose lower tier plan
4. Changes take effect at next billing cycle
5. Data may be archived if over new limits

### Canceling Subscription
1. Go to Settings > Billing
2. Select "Cancel Plan"
3. Confirm cancellation
4. Access continues until end of billing period
5. Data is preserved for 30 days after cancellation

## Invoicing and Receipts

### Automatic Invoicing
- Invoices generated automatically each billing cycle
- Sent to billing email address
- Available in Settings > Billing
- Include all usage and charges

### Receipt Management
- Download receipts anytime
- Export for accounting purposes
- Historical billing records maintained
- Tax information included where applicable

## Need Help with Billing?

Contact our billing support team:
- Email: billing@gmbbooster.com
- Phone: 1-800-GMB-BILL
- Live Chat: Available 9 AM - 5 PM EST
- Support Portal: Create a billing ticket
      `,
      tags: ["billing", "plans", "pricing", "subscription"],
      lastUpdated: "2024-03-15",
    },
  ];

  // Filter articles based on user type and search
  const getFilteredArticles = () => {
    return articles.filter((article) => {
      const matchesUserType =
        article.userType === "all" ||
        (currentUser?.role === "admin" && article.userType === "admin") ||
        (currentUser?.role === "agency" && article.userType === "agency") ||
        (currentUser?.role === "superadmin" &&
          article.userType === "super-admin") ||
        (!currentUser && article.userType === "all");

      const matchesCategory =
        !selectedCategory || article.category === selectedCategory;

      const matchesSearch =
        !searchQuery ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase()),
        );

      return matchesUserType && matchesCategory && matchesSearch;
    });
  };

  // Filter categories based on user type
  const getFilteredCategories = () => {
    return categories.filter((category) => {
      return (
        category.userType === "all" ||
        (currentUser?.role === "admin" && category.userType === "admin") ||
        (currentUser?.role === "agency" && category.userType === "agency") ||
        (currentUser?.role === "superadmin" &&
          category.userType === "super-admin") ||
        (!currentUser && category.userType === "all")
      );
    });
  };

  // Handlers for super admin editing
  const handleEditArticle = (article: Article) => {
    setEditingArticle({ ...article });
    setSelectedArticle(null);
  };

  const handleDeleteArticle = (articleId: string) => {
    if (confirm("Are you sure you want to delete this article?")) {
      // In real app, this would make an API call
      toast.success("Article deleted successfully");
      setSelectedArticle(null);
    }
  };

  const handleSaveArticle = () => {
    if (!editingArticle) return;

    // In real app, this would make an API call to save
    toast.success("Article saved successfully");
    setEditingArticle(null);
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    const newArticle: Article = {
      id: Date.now().toString(),
      title: "",
      description: "",
      category: "getting-started",
      userType: "all",
      content: "",
      tags: [],
      lastUpdated: new Date().toISOString().split("T")[0],
    };
    setEditingArticle(newArticle);
    setIsCreating(true);
    setSelectedArticle(null);
  };

  const handleMediaUpload = async (file: File) => {
    if (!editingArticle) return;

    setUploadingMedia(true);
    try {
      // In a real app, this would upload to a file service (AWS S3, etc.)
      // For demo, we'll create a placeholder URL
      const fileUrl = URL.createObjectURL(file);
      const fileName = file.name;
      const fileType = file.type;

      let markdownInsert = "";

      if (fileType.startsWith("image/")) {
        markdownInsert = `\n![${fileName}](${fileUrl})\n`;
      } else if (fileType.startsWith("video/")) {
        markdownInsert = `\n<video controls src="${fileUrl}"></video>\n`;
      } else {
        markdownInsert = `\n[Download ${fileName}](${fileUrl})\n`;
      }

      setEditingArticle({
        ...editingArticle,
        content: editingArticle.content + markdownInsert,
      });

      toast.success(
        `${fileType.startsWith("image/") ? "Image" : fileType.startsWith("video/") ? "Video" : "File"} added to article`,
      );
    } catch (error) {
      toast.error("Failed to upload media");
    } finally {
      setUploadingMedia(false);
    }
  };

  const insertMarkdownHelper = (syntax: string, placeholder: string) => {
    if (!editingArticle) return;

    const insertion = syntax.replace("{}", placeholder);
    setEditingArticle({
      ...editingArticle,
      content: editingArticle.content + `\n${insertion}\n`,
    });
  };

  // Load support tickets
  useEffect(() => {
    const savedTickets = localStorage.getItem("support_tickets");
    if (savedTickets) {
      setTickets(JSON.parse(savedTickets));
    }
  }, []);

  const handleCreateTicket = () => {
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const ticket: SupportTicket = {
      id: Date.now().toString(),
      title: newTicket.title,
      category: newTicket.category || "general",
      priority: newTicket.priority,
      status: "open",
      description: newTicket.description,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || "Anonymous",
      updatedAt: new Date().toISOString(),
      attachments: [],
    };

    const updatedTickets = [ticket, ...tickets];
    setTickets(updatedTickets);
    localStorage.setItem("support_tickets", JSON.stringify(updatedTickets));

    setNewTicket({
      title: "",
      category: "",
      priority: "medium",
      description: "",
    });
    setShowCreateTicket(false);
    toast.success("Support ticket created successfully!");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // If no user logged in, show public layout
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-background border-b">
          <div className="container px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <BookOpen className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg">GMB Booster Help</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link to="/signin">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            </div>
          </div>
        </header>
        <main className="container px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Help Center</h1>
            <p className="text-muted-foreground text-lg">
              Find answers, guides, and resources to get the most out of GMB
              Booster
            </p>
          </div>

          {/* Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {getFilteredCategories().map((category) => {
              const Icon = category.icon;
              return (
                <Card
                  key={category.id}
                  className="cursor-pointer transition-all hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {category.name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {category.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Article editing form for super admin
  if (editingArticle) {
    return (
      <LayoutComponent>
        <div className="container px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingArticle(null);
                    setIsCreating(false);
                  }}
                  className="gap-2"
                >
                  ← Back to Help Center
                </Button>
                <h1 className="text-2xl font-bold">
                  {isCreating ? "Create New Article" : "Edit Article"}
                </h1>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingArticle(null);
                    setIsCreating(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSaveArticle}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Article
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        value={editingArticle.title}
                        onChange={(e) =>
                          setEditingArticle({
                            ...editingArticle,
                            title: e.target.value,
                          })
                        }
                        placeholder="Article title"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <select
                        value={editingArticle.category}
                        onChange={(e) =>
                          setEditingArticle({
                            ...editingArticle,
                            category: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        {getFilteredCategories().map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      value={editingArticle.description}
                      onChange={(e) =>
                        setEditingArticle({
                          ...editingArticle,
                          description: e.target.value,
                        })
                      }
                      placeholder="Brief description of the article"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tags</label>
                    <Input
                      value={editingArticle.tags.join(", ")}
                      onChange={(e) =>
                        setEditingArticle({
                          ...editingArticle,
                          tags: e.target.value
                            .split(",")
                            .map((tag) => tag.trim()),
                        })
                      }
                      placeholder="Tags separated by commas"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Content</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="media-upload"
                        accept="image/*,video/*,.pdf,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaUpload(file);
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          document.getElementById("media-upload")?.click()
                        }
                        disabled={uploadingMedia}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingMedia ? "Uploading..." : "Add Media"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Insert
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() =>
                              insertMarkdownHelper("## {}", "Heading")
                            }
                          >
                            Heading
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              insertMarkdownHelper("**{}**", "Bold text")
                            }
                          >
                            Bold Text
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              insertMarkdownHelper("*{}*", "Italic text")
                            }
                          >
                            Italic Text
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              insertMarkdownHelper("- {}", "List item")
                            }
                          >
                            Bullet List
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              insertMarkdownHelper("[{}](url)", "Link text")
                            }
                          >
                            Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              insertMarkdownHelper("```\n{}\n```", "Code here")
                            }
                          >
                            Code Block
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <textarea
                    value={editingArticle.content}
                    onChange={(e) =>
                      setEditingArticle({
                        ...editingArticle,
                        content: e.target.value,
                      })
                    }
                    className="w-full h-96 p-4 border rounded-md font-mono text-sm"
                    placeholder="Article content in markdown format..."
                  />
                </div>
                <div className="mt-4 p-4 border rounded-md bg-muted/20">
                  <p className="text-sm font-medium mb-2">Formatting Help:</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <code># Heading</code> - Creates a large heading
                    </p>
                    <p>
                      <code>**bold**</code> - Makes text bold
                    </p>
                    <p>
                      <code>*italic*</code> - Makes text italic
                    </p>
                    <p>
                      <code>- List item</code> - Creates bullet points
                    </p>
                    <p>
                      <code>[Link text](url)</code> - Creates links
                    </p>
                    <p>
                      <code>![Alt text](image-url)</code> - Embeds images
                    </p>
                    <p>Use the "Add Media" button to upload files directly</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </LayoutComponent>
    );
  }

  // Article detail view
  if (selectedArticle) {
    return (
      <LayoutComponent>
        <div className="container px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                onClick={() => setSelectedArticle(null)}
                className="gap-2"
              >
                ← Back to Help Center
              </Button>
              {isSuper && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleEditArticle(selectedArticle)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteArticle(selectedArticle.id)}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">
                    {selectedArticle.category.replace("-", " ")}
                  </Badge>
                  {selectedArticle.popular && (
                    <Badge variant="default">Popular</Badge>
                  )}
                </div>
                <CardTitle className="text-2xl">
                  {selectedArticle.title}
                </CardTitle>
                <CardDescription className="text-base">
                  {selectedArticle.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: selectedArticle.content
                        .replace(/\n# /g, "\n<h1>")
                        .replace(/\n## /g, "\n<h2>")
                        .replace(/\n### /g, "\n<h3>")
                        .replace(/\n\n/g, "</p><p>")
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n- /g, "\n<li>")
                        .replace(/\n\d+\. /g, "\n<li>")
                        .replace(/^/, "<p>")
                        .replace(/$/, "</p>"),
                    }}
                  />
                </div>
                <div className="mt-8 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span>Last updated: {selectedArticle.lastUpdated}</span>
                      <div className="flex gap-1">
                        {selectedArticle.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Was this helpful?
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </LayoutComponent>
    );
  }

  return (
    <LayoutComponent>
      <div className="container px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            {isSuper && (
              <Button onClick={handleCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Article
              </Button>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">Help Center</h1>
          <p className="text-muted-foreground text-lg">
            Find answers, guides, and resources to get the most out of GMB
            Booster
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {getFilteredCategories().map((category) => {
            const Icon = category.icon;
            return (
              <Card
                key={category.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedCategory === category.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === category.id ? null : category.id,
                  )
                }
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {category.name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {category.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* System Monitoring & Error Logs */}
        {(isSuper || currentUser?.role === "admin") && (
          <Card className="mb-8 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  System Monitoring & Error Logs
                </div>
                <Badge variant="outline" className="bg-white">
                  Admin Access
                </Badge>
              </CardTitle>
              <CardDescription>
                Monitor application health, view crash reports, and access error
                logs for troubleshooting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow border-red-200 bg-red-50"
                  onClick={() => {
                    document
                      .getElementById("crash-logs-section")
                      ?.scrollIntoView({
                        behavior: "smooth",
                      });
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                      <div>
                        <div className="font-semibold text-red-800">
                          7 Critical Errors
                        </div>
                        <div className="text-sm text-red-600">
                          Last 24 hours
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow border-yellow-200 bg-yellow-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-8 w-8 text-yellow-600" />
                      <div>
                        <div className="font-semibold text-yellow-800">
                          89% Uptime
                        </div>
                        <div className="text-sm text-yellow-600">This week</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <User className="h-8 w-8 text-blue-600" />
                      <div>
                        <div className="font-semibold text-blue-800">
                          156 Users
                        </div>
                        <div className="text-sm text-blue-600">
                          Affected by errors
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2">
                <Button
                  className="gap-2"
                  onClick={() => {
                    document
                      .getElementById("crash-logs-section")
                      ?.scrollIntoView({
                        behavior: "smooth",
                      });
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  View Detailed Error Logs
                </Button>
                <Button variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Export Error Report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Popular Articles */}
        {!selectedCategory && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Popular Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getFilteredArticles()
                .filter((article) => article.popular)
                .map((article) => (
                  <Card
                    key={article.id}
                    className="cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base mb-1">
                            {article.title}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {article.description}
                          </CardDescription>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {article.category.replace("-", " ")}
                        </Badge>
                        <Badge variant="default" className="text-xs">
                          Popular
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Articles List */}
        {(selectedCategory || searchQuery) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {selectedCategory
                  ? `${getFilteredCategories().find((c) => c.id === selectedCategory)?.name} Articles`
                  : `Search Results (${getFilteredArticles().length})`}
              </h2>
              {selectedCategory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  View All Categories
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {getFilteredArticles().length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No articles found
                    </h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search terms or browse different
                      categories.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                getFilteredArticles().map((article) => (
                  <Card
                    key={article.id}
                    className="cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base mb-1">
                            {article.title}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {article.description}
                          </CardDescription>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {article.category.replace("-", " ")}
                        </Badge>
                        {article.popular && (
                          <Badge variant="default" className="text-xs">
                            Popular
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="h-3 w-3" />
                          {article.lastUpdated}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Support Tickets Section */}
        {!selectedCategory && !searchQuery && currentUser && (
          <div className="mt-12 pt-8 border-t">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Your Support Tickets</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSupportTickets(!showSupportTickets)}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  {showSupportTickets
                    ? "Hide Tickets"
                    : `View Tickets (${tickets.length})`}
                </Button>
                <Button
                  onClick={() => setShowCreateTicket(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Ticket
                </Button>
              </div>
            </div>

            {showSupportTickets && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Recent Support Tickets
                  </CardTitle>
                  <CardDescription>
                    Track and manage your support requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tickets.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        No support tickets yet
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Create your first support ticket to get help with any
                        issues.
                      </p>
                      <Button
                        onClick={() => setShowCreateTicket(true)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create Your First Ticket
                      </Button>
                    </div>
                  ) : (
                    <div className="responsive-table">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Category
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              Priority
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              Status
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">
                              Created
                            </TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tickets.slice(0, 5).map((ticket) => (
                            <TableRow
                              key={ticket.id}
                              className="cursor-pointer hover:bg-muted/50"
                            >
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {ticket.title}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    #{ticket.id}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {ticket.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={getPriorityColor(ticket.priority)}
                                >
                                  {ticket.priority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={getStatusColor(ticket.status)}
                                >
                                  {ticket.status.replace("_", " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatTableDate(ticket.createdAt)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    // Support ticket details route not yet implemented
                                    navigate("/support")
                                  }
                                >
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Create Ticket Form */}
            {showCreateTicket && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Create Support Ticket
                  </CardTitle>
                  <CardDescription>
                    Describe your issue and we'll get back to you as soon as
                    possible.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Subject *</Label>
                      <Input
                        id="title"
                        placeholder="Brief description of your issue"
                        value={newTicket.title}
                        onChange={(e) =>
                          setNewTicket({ ...newTicket, title: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={newTicket.category}
                        onValueChange={(value) =>
                          setNewTicket({ ...newTicket, category: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technical">
                            Technical Issue
                          </SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="feature">
                            Feature Request
                          </SelectItem>
                          <SelectItem value="bug">Bug Report</SelectItem>
                          <SelectItem value="account">Account Issue</SelectItem>
                          <SelectItem value="general">
                            General Inquiry
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newTicket.priority}
                      onValueChange={(value: any) =>
                        setNewTicket({ ...newTicket, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Please provide detailed information about your issue..."
                      className="min-h-[120px]"
                      value={newTicket.description}
                      onChange={(e) =>
                        setNewTicket({
                          ...newTicket,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateTicket(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTicket} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Ticket
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateTicket(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Quick Links */}
        {!selectedCategory && !searchQuery && (
          <div className="mt-12 pt-8 border-t">
            <h2 className="text-xl font-semibold mb-4">Additional Resources</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Video Tutorials
                  </CardTitle>
                  <CardDescription>
                    Watch step-by-step video guides
                  </CardDescription>
                  <Button variant="outline" className="w-full mt-2">
                    View Tutorials
                  </Button>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Community Forum
                  </CardTitle>
                  <CardDescription>
                    Connect with other users and share tips
                  </CardDescription>
                  <Button variant="outline" className="w-full mt-2">
                    Join Community
                  </Button>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Contact Support
                  </CardTitle>
                  <CardDescription>
                    Get personalized help from our support team
                  </CardDescription>
                  <Button
                    className="w-full mt-2"
                    onClick={() => setShowCreateTicket(true)}
                  >
                    Create Support Ticket
                  </Button>
                </CardHeader>
              </Card>
            </div>
          </div>
        )}

        {/* Detailed Error Logs & Crash Reports */}
        {(isSuper || currentUser?.role === "admin") && (
          <div id="crash-logs-section" className="mt-12 pt-8 border-t">
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Real-Time Error Monitoring & Crash Logs
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Badge variant="destructive">7 Critical</Badge>
                    <Badge variant="outline">12 Warnings</Badge>
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Monitor system health, view detailed error reports, and track
                  user-reported issues. Last updated:{" "}
                  {new Date().toLocaleTimeString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3 text-red-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Critical Application Crashes (Last 24 Hours)
                    </h4>
                    <div className="space-y-3">
                      <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <span className="font-medium text-red-800">
                                Settings Module Crash
                              </span>
                            </div>
                            <span className="text-xs text-red-600">
                              2 hours ago
                            </span>
                          </div>
                          <div className="text-sm text-red-700 mb-2">
                            <strong>Error:</strong> Cannot read property
                            'events' of undefined at Settings.tsx:3206:116
                          </div>
                          <div className="text-xs text-red-600 font-mono bg-red-100 p-2 rounded mb-2">
                            TypeError: Cannot read properties of undefined
                            (reading 'join')
                            <br />
                            at Settings (Settings.tsx:3206:116)
                            <br />
                            at renderWithHooks (chunk-WPQCFWW4.js:11596:35)
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="destructive" className="text-xs">
                              High Priority
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              User: joe@joespizza.com
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Chrome 118
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <span className="font-medium text-red-800">
                                React Key Warning Fixed
                              </span>
                            </div>
                            <span className="text-xs text-red-600">
                              3 hours ago
                            </span>
                          </div>
                          <div className="text-sm text-red-700 mb-2">
                            <strong>Issue:</strong> Each child in a list should
                            have a unique "key" prop
                          </div>
                          <div className="text-xs text-red-600 font-mono bg-red-100 p-2 rounded mb-2">
                            Warning: Each child in a list should have a unique
                            "key" prop
                            <br />
                            Check the render method of ProjectDetail
                            <br />
                            Fixed: Updated photo tags rendering with unique keys
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className="text-xs">
                              Resolved
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Multiple Users
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              React
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 text-yellow-800 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Performance & Runtime Issues
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="p-3">
                          <div className="text-sm font-medium text-yellow-800">
                            Slow Component Renders
                          </div>
                          <div className="text-xs text-yellow-600">
                            Settings.tsx taking {">"}2s to render
                          </div>
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              12 instances today
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="p-3">
                          <div className="text-sm font-medium text-yellow-800">
                            Memory Usage
                          </div>
                          <div className="text-xs text-yellow-600">
                            Gallery component optimization needed
                          </div>
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              5 reports
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Refresh All Logs
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export Error Report
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Create Support Ticket
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Administrative Tools Section at Bottom */}
        <div className="mt-16 pt-8 border-t bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-semibold mb-6 text-center">
              Administrative Tools
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Crash Logs Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-red-100 rounded-full">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold mb-2">
                      Crash Logs & Error Monitoring
                    </h4>
                    <p className="text-muted-foreground mb-4">
                      View detailed error logs, crash reports, and system
                      monitoring data to troubleshoot issues
                    </p>
                    <Button
                      onClick={() =>
                        (window.location.href = "/admin/crash-logs")
                      }
                      className="gap-2"
                    >
                      <Bug className="h-4 w-4" />
                      View Crash Logs
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* System Status Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-green-100 rounded-full">
                        <Activity className="h-8 w-8 text-green-600" />
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold mb-2">
                      System Status
                    </h4>
                    <p className="text-muted-foreground mb-4">
                      Check the current status of our services and any ongoing
                      incidents
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.open("/status", "_blank")}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View System Status
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </LayoutComponent>
  );
}

import React from "react";
import { AppLayout } from "../components/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  ExternalLink,
  Star,
  Users,
  BarChart3,
  Mail,
  Camera,
  FileText,
  Globe,
  Smartphone,
  Monitor,
  Zap,
  MessageSquare,
  Calendar,
  CreditCard,
  Target,
  TrendingUp,
  Search,
  Database,
} from "lucide-react";

interface Tool {
  name: string;
  description: string;
  category: string;
  price: string;
  rating: number;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  url: string;
  isAffiliate?: boolean;
  badge?: string;
}

const tools: Tool[] = [
  // SEO & Analytics Tools
  {
    name: "SEMrush",
    description: "Complete SEO toolkit for keyword research, competitor analysis, and ranking tracking.",
    category: "SEO & Analytics",
    price: "$129.95/month",
    rating: 4.5,
    features: ["Keyword Research", "Competitor Analysis", "Site Audit", "Backlink Analysis"],
    icon: Search,
    url: "https://semrush.com",
    isAffiliate: true,
    badge: "Most Popular"
  },
  {
    name: "Google Analytics 4",
    description: "Free web analytics service that tracks and reports website traffic and user behavior.",
    category: "SEO & Analytics",
    price: "Free",
    rating: 4.3,
    features: ["User Tracking", "Conversion Analytics", "Custom Reports", "Real-time Data"],
    icon: BarChart3,
    url: "https://analytics.google.com",
  },
  {
    name: "Ahrefs",
    description: "Comprehensive SEO toolset for backlink analysis, keyword research, and content marketing.",
    category: "SEO & Analytics",
    price: "$99/month",
    rating: 4.6,
    features: ["Backlink Analysis", "Keyword Explorer", "Content Gap", "Rank Tracker"],
    icon: TrendingUp,
    url: "https://ahrefs.com",
    isAffiliate: true,
  },

  // Social Media Management
  {
    name: "Hootsuite",
    description: "Social media management platform for scheduling posts and analyzing performance.",
    category: "Social Media",
    price: "$49/month",
    rating: 4.1,
    features: ["Multi-platform Posting", "Analytics", "Team Collaboration", "Content Calendar"],
    icon: MessageSquare,
    url: "https://hootsuite.com",
    isAffiliate: true,
  },
  {
    name: "Buffer",
    description: "Simple social media scheduling and analytics tool for small businesses.",
    category: "Social Media",
    price: "$15/month",
    rating: 4.4,
    features: ["Post Scheduling", "Analytics", "Team Features", "Browser Extension"],
    icon: Calendar,
    url: "https://buffer.com",
    isAffiliate: true,
  },

  // Email Marketing
  {
    name: "Mailchimp",
    description: "All-in-one marketing platform for email campaigns, automation, and audience insights.",
    category: "Email Marketing",
    price: "$10/month",
    rating: 4.2,
    features: ["Email Campaigns", "Automation", "A/B Testing", "Landing Pages"],
    icon: Mail,
    url: "https://mailchimp.com",
    isAffiliate: true,
    badge: "Beginner Friendly"
  },
  {
    name: "ConvertKit",
    description: "Email marketing platform designed for creators and online businesses.",
    category: "Email Marketing",
    price: "$29/month",
    rating: 4.5,
    features: ["Visual Automation", "Subscriber Tagging", "Landing Pages", "Integrations"],
    icon: Users,
    url: "https://convertkit.com",
    isAffiliate: true,
  },

  // Design & Creative
  {
    name: "Canva Pro",
    description: "Professional design platform with templates, stock photos, and collaboration tools.",
    category: "Design & Creative",
    price: "$12.99/month",
    rating: 4.7,
    features: ["Design Templates", "Stock Photos", "Brand Kit", "Team Collaboration"],
    icon: Camera,
    url: "https://canva.com/pro",
    isAffiliate: true,
    badge: "Essential"
  },
  {
    name: "Adobe Creative Suite",
    description: "Industry-standard creative applications for design, video, and web development.",
    category: "Design & Creative",
    price: "$54.99/month",
    rating: 4.6,
    features: ["Photoshop", "Illustrator", "Premiere Pro", "After Effects"],
    icon: FileText,
    url: "https://adobe.com/creativecloud",
    isAffiliate: true,
  },

  // Website & Development
  {
    name: "WordPress.com",
    description: "Popular content management system for building and managing websites.",
    category: "Website & Development",
    price: "$25/month",
    rating: 4.0,
    features: ["Custom Themes", "Plugins", "SEO Tools", "E-commerce"],
    icon: Globe,
    url: "https://wordpress.com",
    isAffiliate: true,
  },
  {
    name: "Webflow",
    description: "Visual web design platform that generates clean, semantic code automatically.",
    category: "Website & Development",
    price: "$23/month",
    rating: 4.4,
    features: ["Visual Designer", "CMS", "E-commerce", "Hosting"],
    icon: Monitor,
    url: "https://webflow.com",
    isAffiliate: true,
  },

  // Marketing Automation
  {
    name: "HubSpot",
    description: "Comprehensive inbound marketing, sales, and customer service platform.",
    category: "Marketing Automation",
    price: "$45/month",
    rating: 4.4,
    features: ["CRM", "Email Marketing", "Lead Tracking", "Analytics"],
    icon: Zap,
    url: "https://hubspot.com",
    isAffiliate: true,
    badge: "All-in-One"
  },
  {
    name: "ActiveCampaign",
    description: "Customer experience automation platform combining email marketing and CRM.",
    category: "Marketing Automation",
    price: "$39/month",
    rating: 4.5,
    features: ["Email Automation", "CRM", "Sales Automation", "Machine Learning"],
    icon: Target,
    url: "https://activecampaign.com",
    isAffiliate: true,
  },

  // Project Management
  {
    name: "Monday.com",
    description: "Work operating system for teams to run projects and workflows efficiently.",
    category: "Project Management",
    price: "$24/month",
    rating: 4.3,
    features: ["Project Tracking", "Team Collaboration", "Custom Workflows", "Time Tracking"],
    icon: Calendar,
    url: "https://monday.com",
    isAffiliate: true,
  },
  {
    name: "Asana",
    description: "Project management tool for organizing work and improving team productivity.",
    category: "Project Management",
    price: "$10.99/month",
    rating: 4.2,
    features: ["Task Management", "Team Collaboration", "Reporting", "Goal Setting"],
    icon: Users,
    url: "https://asana.com",
    isAffiliate: true,
  },

  // Payment & Invoicing
  {
    name: "Stripe",
    description: "Online payment processing platform for internet businesses of all sizes.",
    category: "Payment & Invoicing",
    price: "2.9% + 30¢ per transaction",
    rating: 4.5,
    features: ["Online Payments", "Subscriptions", "Invoicing", "International"],
    icon: CreditCard,
    url: "https://stripe.com",
  },
  {
    name: "FreshBooks",
    description: "Cloud-based accounting software designed for small business owners.",
    category: "Payment & Invoicing",
    price: "$15/month",
    rating: 4.4,
    features: ["Invoicing", "Expense Tracking", "Time Tracking", "Client Portal"],
    icon: FileText,
    url: "https://freshbooks.com",
    isAffiliate: true,
  },
];

const categories = [
  "All",
  "SEO & Analytics",
  "Social Media",
  "Email Marketing",
  "Design & Creative",
  "Website & Development",
  "Marketing Automation",
  "Project Management",
  "Payment & Invoicing",
];

export default function Tools() {
  const [selectedCategory, setSelectedCategory] = React.useState("All");
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredTools = tools.filter((tool) => {
    const matchesCategory = selectedCategory === "All" || tool.category === selectedCategory;
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-400"
            : i < rating
            ? "fill-yellow-200 text-yellow-400"
            : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <AppLayout
      title="Marketing Tools"
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Tools" },
      ]}
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marketing Tools</h1>
            <p className="text-muted-foreground">
              Recommended tools and software to help grow your marketing agency. 
              Some links may contain affiliate codes to support our platform.
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="whitespace-nowrap"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool, index) => (
            <Card key={index} className="relative overflow-hidden">
              {tool.badge && (
                <div className="absolute top-4 right-4">
                  <Badge variant="secondary" className="text-xs">
                    {tool.badge}
                  </Badge>
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <tool.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{tool.category}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <CardDescription className="text-sm">
                  {tool.description}
                </CardDescription>

                {/* Rating and Price */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {renderStars(tool.rating)}
                    <span className="text-sm text-muted-foreground ml-1">
                      {tool.rating}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{tool.price}</p>
                    {tool.isAffiliate && (
                      <p className="text-xs text-muted-foreground">Affiliate</p>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Key Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {tool.features.slice(0, 3).map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {tool.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{tool.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <Button 
                  asChild 
                  className="w-full"
                  size="sm"
                >
                  <a 
                    href={tool.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    Learn More
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Results */}
        {filteredTools.length === 0 && (
          <div className="text-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">No tools found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Disclaimer:</strong> Some links on this page are affiliate links, which means we may earn a commission 
              if you make a purchase through these links at no additional cost to you. This helps support our platform and allows 
              us to continue providing valuable tools and resources. We only recommend tools that we believe will benefit your 
              marketing agency.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

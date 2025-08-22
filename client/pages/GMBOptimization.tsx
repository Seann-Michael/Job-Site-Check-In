import React, { useState, useEffect } from "react";
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
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Globe,
  Star,
  Users,
  Edit3,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  Wand2,
  Building2,
  Calendar,
  MessageSquare,
  Image as ImageIcon,
  AlertCircle,
  Settings,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";

// Types for GMB data
interface BusinessHours {
  day: string;
  open: string;
  close: string;
  isClosed: boolean;
}

interface QAItem {
  id: string;
  question: string;
  answer: string;
  author: string;
  date: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  primary: boolean;
}

interface ServiceMenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  image?: string;
  category: string;
}

interface GMBAuditItem {
  id: string;
  category: string;
  title: string;
  description: string;
  status: "critical" | "warning" | "good";
  impact: "high" | "medium" | "low";
  actionRequired: string;
}

// Mock GMB profile data
const mockGMBProfile = {
  businessName: "Joe's Pizza & More",
  address: "2275 Lejeune Cir, Fairfield, CA 94533",
  phone: "(707) 555-0123",
  website: "https://joespizza.com",
  categories: [
    { id: "1", name: "Pizza Restaurant", primary: true },
    { id: "2", name: "Italian Restaurant", primary: false },
    { id: "3", name: "Delivery Service", primary: false },
  ],
  hours: [
    { day: "Monday", open: "11:00", close: "22:00", isClosed: false },
    { day: "Tuesday", open: "11:00", close: "22:00", isClosed: false },
    { day: "Wednesday", open: "11:00", close: "22:00", isClosed: false },
    { day: "Thursday", open: "11:00", close: "22:00", isClosed: false },
    { day: "Friday", open: "11:00", close: "23:00", isClosed: false },
    { day: "Saturday", open: "12:00", close: "23:00", isClosed: false },
    { day: "Sunday", open: "12:00", close: "21:00", isClosed: false },
  ],
  qas: [
    {
      id: "1",
      question: "Do you offer gluten-free pizza?",
      answer: "Yes! We have gluten-free crust available for all our pizzas.",
      author: "Business Owner",
      date: "2024-01-15",
    },
    {
      id: "2",
      question: "What are your delivery hours?",
      answer: "We deliver until 30 minutes before closing time.",
      author: "Business Owner",
      date: "2024-01-10",
    },
  ],
  serviceMenu: [
    {
      id: "1",
      name: "Margherita Pizza",
      description: "Fresh mozzarella, tomato sauce, basil",
      price: "$18.99",
      category: "Pizza",
      image: "/placeholder-pizza.jpg",
    },
    {
      id: "2",
      name: "Pepperoni Pizza", 
      description: "Classic pepperoni with mozzarella cheese",
      price: "$21.99",
      category: "Pizza",
      image: "/placeholder-pizza.jpg",
    },
  ],
  lastScan: "2024-01-20T10:30:00Z",
  overallScore: 78,
};

// Mock audit results
const mockAuditResults: GMBAuditItem[] = [
  {
    id: "1",
    category: "Business Information",
    title: "Missing Business Description",
    description: "Your business description is empty. A compelling description helps customers understand what you offer.",
    status: "critical",
    impact: "high",
    actionRequired: "Add a detailed business description (150-750 characters)",
  },
  {
    id: "2",
    category: "Photos",
    title: "Insufficient Photos",
    description: "You only have 3 photos. Businesses with more photos get 42% more requests for directions.",
    status: "warning", 
    impact: "medium",
    actionRequired: "Add more high-quality photos (minimum 10 recommended)",
  },
  {
    id: "3",
    category: "Reviews",
    title: "Low Review Response Rate",
    description: "You're responding to only 30% of reviews. Responding to reviews shows you care about customers.",
    status: "warning",
    impact: "medium", 
    actionRequired: "Respond to all recent reviews, especially negative ones",
  },
  {
    id: "4",
    category: "Q&A",
    title: "Unanswered Questions",
    description: "You have 5 unanswered questions from customers.",
    status: "warning",
    impact: "medium",
    actionRequired: "Answer all pending customer questions",
  },
  {
    id: "5",
    category: "Business Hours",
    title: "Hours Updated",
    description: "Your business hours are properly configured and up to date.",
    status: "good",
    impact: "low",
    actionRequired: "No action needed",
  },
];

export default function GMBOptimization() {
  const [loading, setLoading] = useState(false);
  const [gmbProfile, setGmbProfile] = useState(mockGMBProfile);
  const [auditResults, setAuditResults] = useState(mockAuditResults);
  const [selectedTab, setSelectedTab] = useState("audit");
  const [editingHours, setEditingHours] = useState(false);
  const [editingQA, setEditingQA] = useState<string | null>(null);
  const [newQA, setNewQA] = useState({ question: "", answer: "" });
  const [editingService, setEditingService] = useState<string | null>(null);
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    price: "",
    category: "Pizza",
    image: "",
  });

  const breadcrumbs = [
    { label: "GMB Optimization" },
  ];

  // Handle GMB profile scan
  const handleScan = async () => {
    setLoading(true);
    try {
      // Simulate API call to scan GMB profile
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Update last scan time
      setGmbProfile(prev => ({
        ...prev,
        lastScan: new Date().toISOString(),
      }));
      
      toast.success("GMB profile scan completed successfully!");
    } catch (error) {
      toast.error("Failed to scan GMB profile");
    } finally {
      setLoading(false);
    }
  };

  // Handle saving business hours
  const handleSaveHours = () => {
    setEditingHours(false);
    toast.success("Business hours updated successfully!");
  };

  // Handle Q&A management
  const handleAddQA = () => {
    if (!newQA.question.trim() || !newQA.answer.trim()) {
      toast.error("Please fill in both question and answer");
      return;
    }

    const qa: QAItem = {
      id: Date.now().toString(),
      question: newQA.question,
      answer: newQA.answer,
      author: "Business Owner",
      date: new Date().toISOString().split('T')[0],
    };

    setGmbProfile(prev => ({
      ...prev,
      qas: [...prev.qas, qa],
    }));

    setNewQA({ question: "", answer: "" });
    toast.success("Q&A added successfully!");
  };

  const handleDeleteQA = (id: string) => {
    setGmbProfile(prev => ({
      ...prev,
      qas: prev.qas.filter(qa => qa.id !== id),
    }));
    toast.success("Q&A deleted successfully!");
  };

  // Handle service menu management
  const handleAddService = async (withAI: boolean = false) => {
    if (!newService.name.trim()) {
      toast.error("Please enter a service name");
      return;
    }

    let serviceData = { ...newService };

    if (withAI) {
      // Simulate AI content generation
      toast.info("Generating AI content...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      serviceData.description = `Delicious ${newService.name.toLowerCase()} made with fresh, high-quality ingredients. A customer favorite that's perfect for any occasion.`;
      serviceData.image = "/placeholder-ai-generated.jpg";
    }

    const service: ServiceMenuItem = {
      id: Date.now().toString(),
      ...serviceData,
    };

    setGmbProfile(prev => ({
      ...prev,
      serviceMenu: [...prev.serviceMenu, service],
    }));

    setNewService({
      name: "",
      description: "",
      price: "",
      category: "Pizza",
      image: "",
    });

    toast.success("Service added successfully!");
  };

  const handleDeleteService = (id: string) => {
    setGmbProfile(prev => ({
      ...prev,
      serviceMenu: prev.serviceMenu.filter(service => service.id !== id),
    }));
    toast.success("Service deleted successfully!");
  };

  // Get audit summary
  const auditSummary = {
    critical: auditResults.filter(item => item.status === "critical").length,
    warning: auditResults.filter(item => item.status === "warning").length,
    good: auditResults.filter(item => item.status === "good").length,
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              GMB Optimization
            </h1>
            <p className="text-muted-foreground mt-2">
              Scan, audit, and optimize your Google My Business profile
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Last Scan</div>
              <div className="text-sm font-medium">
                {new Date(gmbProfile.lastScan).toLocaleString()}
              </div>
            </div>
            <Button
              onClick={handleScan}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {loading ? "Scanning..." : "Scan Profile"}
            </Button>
          </div>
        </div>

        {/* Profile Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Business Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-muted-foreground">Business Name</div>
                <div className="font-medium">{gmbProfile.businessName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Address</div>
                <div className="font-medium">{gmbProfile.address}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Phone</div>
                <div className="font-medium">{gmbProfile.phone}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-primary">
                    {gmbProfile.overallScore}%
                  </div>
                  <div className="text-sm text-muted-foreground">Optimized</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="audit" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Audit
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-2">
              <Clock className="h-4 w-4" />
              Hours
            </TabsTrigger>
            <TabsTrigger value="qa" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Q&A
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Settings className="h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Services
            </TabsTrigger>
          </TabsList>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-6">
            {/* Audit Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        {auditSummary.critical}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Critical Issues
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">
                        {auditSummary.warning}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Warnings
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {auditSummary.good}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Good Items
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Audit Results */}
            <Card>
              <CardHeader>
                <CardTitle>Audit Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {auditResults.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge
                              variant={
                                item.status === "critical"
                                  ? "destructive"
                                  : item.status === "warning"
                                  ? "secondary"
                                  : "default"
                              }
                            >
                              {item.category}
                            </Badge>
                            <div className="font-medium">{item.title}</div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {item.description}
                          </p>
                          <div className="text-sm font-medium text-primary">
                            Action: {item.actionRequired}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              item.impact === "high"
                                ? "text-red-600 border-red-600"
                                : item.impact === "medium"
                                ? "text-yellow-600 border-yellow-600"
                                : "text-green-600 border-green-600"
                            }
                          >
                            {item.impact} impact
                          </Badge>
                          {item.status === "critical" && (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          )}
                          {item.status === "warning" && (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                          )}
                          {item.status === "good" && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hours Tab */}
          <TabsContent value="hours" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Business Hours
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingHours(!editingHours)}
                    className="gap-2"
                  >
                    {editingHours ? (
                      <>
                        <X className="h-4 w-4" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-4 w-4" />
                        Edit Hours
                      </>
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {gmbProfile.hours.map((hour, index) => (
                    <div key={hour.day} className="flex items-center justify-between">
                      <div className="font-medium w-24">{hour.day}</div>
                      {editingHours ? (
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={hour.isClosed}
                              onChange={(e) => {
                                const newHours = [...gmbProfile.hours];
                                newHours[index].isClosed = e.target.checked;
                                setGmbProfile(prev => ({ ...prev, hours: newHours }));
                              }}
                            />
                            Closed
                          </label>
                          {!hour.isClosed && (
                            <>
                              <Input
                                type="time"
                                value={hour.open}
                                onChange={(e) => {
                                  const newHours = [...gmbProfile.hours];
                                  newHours[index].open = e.target.value;
                                  setGmbProfile(prev => ({ ...prev, hours: newHours }));
                                }}
                                className="w-32"
                              />
                              <span>to</span>
                              <Input
                                type="time"
                                value={hour.close}
                                onChange={(e) => {
                                  const newHours = [...gmbProfile.hours];
                                  newHours[index].close = e.target.value;
                                  setGmbProfile(prev => ({ ...prev, hours: newHours }));
                                }}
                                className="w-32"
                              />
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          {hour.isClosed ? "Closed" : `${hour.open} - ${hour.close}`}
                        </div>
                      )}
                    </div>
                  ))}
                  {editingHours && (
                    <div className="flex justify-end gap-2 pt-4">
                      <Button onClick={handleSaveHours} className="gap-2">
                        <Save className="h-4 w-4" />
                        Save Hours
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Q&A Tab */}
          <TabsContent value="qa" className="space-y-6">
            {/* Add New Q&A */}
            <Card>
              <CardHeader>
                <CardTitle>Add New Q&A</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="question">Question</Label>
                  <Input
                    id="question"
                    value={newQA.question}
                    onChange={(e) => setNewQA(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="Enter customer question..."
                  />
                </div>
                <div>
                  <Label htmlFor="answer">Answer</Label>
                  <Textarea
                    id="answer"
                    value={newQA.answer}
                    onChange={(e) => setNewQA(prev => ({ ...prev, answer: e.target.value }))}
                    placeholder="Enter your answer..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleAddQA} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Q&A
                </Button>
              </CardContent>
            </Card>

            {/* Existing Q&As */}
            <Card>
              <CardHeader>
                <CardTitle>Questions & Answers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {gmbProfile.qas.map((qa) => (
                    <div key={qa.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-medium mb-2">Q: {qa.question}</div>
                          <div className="text-muted-foreground">A: {qa.answer}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingQA(qa.id)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteQA(qa.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        By {qa.author} on {new Date(qa.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {gmbProfile.qas.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No questions and answers yet. Add your first Q&A above.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Service Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {gmbProfile.categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="font-medium">{category.name}</div>
                        {category.primary && (
                          <Badge variant="default">Primary</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        {!category.primary && (
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Add Category
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-6">
            {/* Add New Service */}
            <Card>
              <CardHeader>
                <CardTitle>Add New Service</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="service-name">Service Name</Label>
                    <Input
                      id="service-name"
                      value={newService.name}
                      onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter service name..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="service-price">Price (Optional)</Label>
                    <Input
                      id="service-price"
                      value={newService.price}
                      onChange={(e) => setNewService(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="$0.00"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="service-category">Category</Label>
                  <Select
                    value={newService.category}
                    onValueChange={(value) => setNewService(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pizza">Pizza</SelectItem>
                      <SelectItem value="Appetizers">Appetizers</SelectItem>
                      <SelectItem value="Beverages">Beverages</SelectItem>
                      <SelectItem value="Desserts">Desserts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="service-description">Description</Label>
                  <Textarea
                    id="service-description"
                    value={newService.description}
                    onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter service description..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => handleAddService(false)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Service
                  </Button>
                  <Button
                    onClick={() => handleAddService(true)}
                    variant="outline"
                    className="gap-2"
                  >
                    <Wand2 className="h-4 w-4" />
                    Add with AI
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Image
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Existing Services */}
            <Card>
              <CardHeader>
                <CardTitle>Service Menu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gmbProfile.serviceMenu.map((service) => (
                    <div key={service.id} className="border rounded-lg p-4 space-y-3">
                      {service.image && (
                        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-medium">{service.name}</div>
                          {service.price && (
                            <div className="font-bold text-primary">{service.price}</div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {service.description}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {service.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingService(service.id)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteService(service.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {gmbProfile.serviceMenu.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-8">
                      No services added yet. Add your first service above.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ThumbsUp,
  MessageSquare,
  Search,
  Lightbulb,
  Rocket,
  CheckCircle,
  Clock,
  Code,
  Calendar,
  User,
  Filter,
  Zap,
  Smartphone,
  BarChart3,
  Settings,
  Globe,
  CreditCard,
  Mail,
  Shield,
  FileText,
  Plus,
  X,
  Send,
} from "lucide-react";
import { toast } from "sonner";

interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  status:
    | "submitted"
    | "under-review"
    | "planned"
    | "in-progress"
    | "completed"
    | "declined";
  votes: number;
  userVoted: boolean;
  author: string;
  createdAt: string;
  comments: Comment[];
  priority: "low" | "medium" | "high";
}

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  isAdmin?: boolean;
}

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: "planned" | "in-progress" | "completed";
  category: string;
  votes: number;
  estimatedCompletion?: string;
  completedAt?: string;
}

interface CategoryBoard {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  ideaCount: number;
  totalVotes: number;
  color: string;
}

interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  type: "feature" | "improvement" | "bugfix" | "breaking";
  title: string;
  description: string;
  items: string[];
}

export default function Ideas() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [categoryBoards, setCategoryBoards] = useState<CategoryBoard[]>([]);
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>(
    [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("boards");
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState({
    title: "",
    description: "",
    category: "",
    justification: "",
  });

  useEffect(() => {
    loadCategoryBoards();
    loadIdeas();
    loadRoadmap();
    loadChangelog();
  }, []);

  const loadCategoryBoards = () => {
    const boards: CategoryBoard[] = [
      {
        id: "automation",
        name: "Automation & Workflows",
        description: "Streamline processes with smart automation",
        icon: Zap,
        ideaCount: 89,
        totalVotes: 1247,
        color: "bg-blue-500",
      },
      {
        id: "mobile",
        name: "Mobile Experience",
        description: "Enhance mobile apps and responsive design",
        icon: Smartphone,
        ideaCount: 34,
        totalVotes: 892,
        color: "bg-purple-500",
      },
      {
        id: "analytics",
        name: "Analytics & Reporting",
        description: "Better insights and data visualization",
        icon: BarChart3,
        ideaCount: 67,
        totalVotes: 1456,
        color: "bg-green-500",
      },
      {
        id: "integrations",
        name: "Integrations & APIs",
        description: "Connect with more tools and services",
        icon: Globe,
        ideaCount: 45,
        totalVotes: 678,
        color: "bg-orange-500",
      },
      {
        id: "payments",
        name: "Payments & Billing",
        description: "Payment processing and billing features",
        icon: CreditCard,
        ideaCount: 23,
        totalVotes: 534,
        color: "bg-emerald-500",
      },
      {
        id: "communication",
        name: "Communication",
        description: "Email, SMS, and messaging improvements",
        icon: Mail,
        ideaCount: 56,
        totalVotes: 789,
        color: "bg-pink-500",
      },
      {
        id: "security",
        name: "Security & Privacy",
        description: "Enhanced security and privacy controls",
        icon: Shield,
        ideaCount: 19,
        totalVotes: 345,
        color: "bg-red-500",
      },
      {
        id: "ui-ux",
        name: "UI/UX Improvements",
        description: "User interface and experience enhancements",
        icon: Settings,
        ideaCount: 78,
        totalVotes: 1123,
        color: "bg-indigo-500",
      },
      {
        id: "documentation",
        name: "Documentation",
        description: "Improve guides, tutorials, and help content",
        icon: FileText,
        ideaCount: 12,
        totalVotes: 156,
        color: "bg-gray-500",
      },
    ];
    setCategoryBoards(boards);
  };

  const loadIdeas = () => {
    const mockIdeas: Idea[] = [
      {
        id: "1",
        title: "Dark Mode Support",
        description:
          "Add a dark theme option for better usability in low light environments",
        category: "ui-ux",
        status: "planned",
        votes: 42,
        userVoted: false,
        author: "John Smith",
        createdAt: "2024-01-15T10:30:00Z",
        comments: [],
        priority: "high",
      },
      {
        id: "2",
        title: "Native Mobile App",
        description:
          "Native mobile application for iOS and Android to manage projects on the go",
        category: "mobile",
        status: "under-review",
        votes: 58,
        userVoted: true,
        author: "Sarah Johnson",
        createdAt: "2024-01-10T09:15:00Z",
        comments: [],
        priority: "high",
      },
      {
        id: "3",
        title: "Advanced Analytics Dashboard",
        description:
          "More detailed analytics with custom metrics and better data visualization",
        category: "analytics",
        status: "submitted",
        votes: 34,
        userVoted: false,
        author: "Mike Chen",
        createdAt: "2024-01-12T14:20:00Z",
        comments: [],
        priority: "medium",
      },
      {
        id: "4",
        title: "Zapier Integration",
        description:
          "Connect with Zapier for unlimited automation possibilities",
        category: "integrations",
        status: "planned",
        votes: 67,
        userVoted: false,
        author: "Lisa Rodriguez",
        createdAt: "2024-01-08T11:45:00Z",
        comments: [],
        priority: "high",
      },
    ];
    setIdeas(mockIdeas);
  };

  const loadRoadmap = () => {
    const mockRoadmap: RoadmapItem[] = [
      {
        id: "r1",
        title: "Dark Mode Support",
        description: "Implement system-wide dark theme with user preferences",
        status: "planned",
        category: "UI/UX",
        votes: 74,
        estimatedCompletion: "2024-06-01",
      },
      {
        id: "r2",
        title: "Advanced Reporting Engine",
        description:
          "Enhanced analytics and custom report generation with export capabilities",
        status: "in-progress",
        category: "Analytics",
        votes: 128,
        estimatedCompletion: "2024-04-15",
      },
      {
        id: "r3",
        title: "Mobile Push Notifications",
        description: "Real-time push notifications for mobile devices",
        status: "completed",
        category: "Mobile",
        votes: 89,
        completedAt: "2024-02-01",
      },
      {
        id: "r4",
        title: "Webhook Management",
        description: "Improved webhook configuration and monitoring tools",
        status: "planned",
        category: "Integrations",
        votes: 45,
        estimatedCompletion: "2024-07-01",
      },
    ];
    setRoadmapItems(mockRoadmap);
  };

  const loadChangelog = () => {
    const mockChangelog: ChangelogEntry[] = [
      {
        id: "v2.1.0",
        version: "2.1.0",
        date: "2024-03-15",
        type: "feature",
        title: "Ideas & Roadmap System",
        description:
          "Launched comprehensive ideas and roadmap management with voting",
        items: [
          "Added category boards for organizing feature requests",
          "Implemented voting system with thumbs up/down",
          "Created roadmap visualization with planned, in-progress, and completed columns",
          "Added individual idea detail pages with commenting",
          "Integrated changelog for tracking platform updates",
        ],
      },
      {
        id: "v2.0.5",
        version: "2.0.5",
        date: "2024-03-10",
        type: "improvement",
        title: "Review System Enhancements",
        description: "Enhanced review collection and management capabilities",
        items: [
          "Improved review gate UI with better mobile responsiveness",
          "Added AI-powered review enhancement with SEO optimization",
          "Enhanced admin review dashboard with sorting and filtering",
          "Added Google My Business integration metrics",
          "Implemented review request cancellation",
        ],
      },
      {
        id: "v2.0.4",
        version: "2.0.4",
        date: "2024-03-05",
        type: "bugfix",
        title: "Bug Fixes & Stability",
        description: "Fixed critical issues and improved system stability",
        items: [
          "Fixed React key warnings in project detail and settings pages",
          "Resolved sidebar navigation issues on mobile devices",
          "Fixed photo upload issues in gallery management",
          "Improved error handling in review submission flow",
          "Fixed timezone issues in analytics reporting",
        ],
      },
      {
        id: "v2.0.2",
        version: "2.0.2",
        date: "2024-02-20",
        type: "improvement",
        title: "Admin Dashboard Improvements",
        description: "Enhanced admin interface and user experience",
        items: [
          "Redesigned admin sidebar with collapsible navigation",
          "Added business profile switching for multi-business users",
          "Improved breadcrumb navigation system",
          "Enhanced user avatar and profile management",
          "Added notification center with badge indicators",
        ],
      },
    ];
    setChangelogEntries(mockChangelog);
  };

  const handleVote = (ideaId: string) => {
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id === ideaId) {
          return {
            ...idea,
            votes: idea.userVoted ? idea.votes - 1 : idea.votes + 1,
            userVoted: !idea.userVoted,
          };
        }
        return idea;
      }),
    );
    toast.success("Vote recorded!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "in-progress":
        return (
          <Badge className="bg-blue-500">
            <Code className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case "planned":
        return (
          <Badge className="bg-purple-500">
            <Calendar className="h-3 w-3 mr-1" />
            Planned
          </Badge>
        );
      case "under-review":
        return (
          <Badge className="bg-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            Under Review
          </Badge>
        );
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge variant="secondary">Submitted</Badge>;
    }
  };

  const filteredIdeas = ideas.filter((idea) => {
    if (selectedCategory && idea.category !== selectedCategory) {
      return false;
    }
    if (
      searchTerm &&
      !idea.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !idea.description.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getCategoryName = (categoryId: string) => {
    const board = categoryBoards.find((b) => b.id === categoryId);
    return board ? board.name : categoryId;
  };

  const handleSuggestionSubmit = () => {
    if (
      !suggestionForm.title ||
      !suggestionForm.description ||
      !suggestionForm.category
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Create new idea submission (pending approval)
    const newIdea: Idea = {
      id: `idea-${Date.now()}`,
      title: suggestionForm.title,
      description: suggestionForm.description,
      category: suggestionForm.category,
      status: "submitted",
      votes: 1, // Author's vote
      userVoted: true,
      author: "You", // Current user
      createdAt: new Date().toISOString(),
      comments: [],
      priority: "low",
    };

    // In real app, this would send to super admin for approval
    // For demo, add directly to ideas list
    setIdeas((prev) => [newIdea, ...prev]);

    // Reset form
    setSuggestionForm({
      title: "",
      description: "",
      category: "",
      justification: "",
    });
    setShowSuggestionForm(false);

    toast.success(
      "Feature suggestion submitted! It will be reviewed by our team.",
    );
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Ideas & Roadmap
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Share your ideas and see what's coming next
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab("boards")}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "boards"
                      ? "bg-green-100 text-green-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Boards
                </button>
                <button
                  onClick={() => setActiveTab("roadmap")}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "roadmap"
                      ? "bg-green-100 text-green-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Roadmap
                </button>
                <button
                  onClick={() => setActiveTab("feedback")}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "feedback"
                      ? "bg-green-100 text-green-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Feedback
                </button>
                <button
                  onClick={() => setActiveTab("changelog")}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "changelog"
                      ? "bg-green-100 text-green-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Changelog
                </button>
              </div>

              <div className="flex items-center gap-4">
                <Dialog
                  open={showSuggestionForm}
                  onOpenChange={setShowSuggestionForm}
                >
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Suggest Feature
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                      <DialogTitle>Suggest a New Feature</DialogTitle>
                      <DialogDescription>
                        Share your idea with our team. All suggestions are
                        reviewed before being published.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="title">Feature Title *</Label>
                        <Input
                          id="title"
                          value={suggestionForm.title}
                          onChange={(e) =>
                            setSuggestionForm((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Brief, descriptive title for your feature idea"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="category">Category *</Label>
                        <Select
                          value={suggestionForm.category}
                          onValueChange={(value) =>
                            setSuggestionForm((prev) => ({
                              ...prev,
                              category: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryBoards.map((board) => (
                              <SelectItem key={board.id} value={board.id}>
                                {board.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="description">
                          Feature Description *
                        </Label>
                        <Textarea
                          id="description"
                          value={suggestionForm.description}
                          onChange={(e) =>
                            setSuggestionForm((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Describe your feature idea in detail. What problem does it solve? How would it work?"
                          className="min-h-[100px]"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="justification">
                          Why is this important? (Optional)
                        </Label>
                        <Textarea
                          id="justification"
                          value={suggestionForm.justification}
                          onChange={(e) =>
                            setSuggestionForm((prev) => ({
                              ...prev,
                              justification: e.target.value,
                            }))
                          }
                          placeholder="Help us understand the value and impact of this feature"
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowSuggestionForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSuggestionSubmit}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Submit Suggestion
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Boards Tab */}
          {activeTab === "boards" && (
            <div className="space-y-8">
              {/* Category Boards */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  Boards
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryBoards.map((board) => (
                    <div
                      key={board.id}
                      onClick={() => {
                        setSelectedCategory(board.id);
                        setActiveTab("feedback");
                      }}
                      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className={`p-3 rounded-lg ${board.color} text-white`}
                        >
                          <board.icon className="h-6 w-6" />
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {board.totalVotes}
                          </div>
                          <div className="text-xs text-gray-500">votes</div>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                        {board.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {board.description}
                      </p>
                      <div className="text-xs text-gray-500">
                        {board.ideaCount} ideas
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Roadmap Tab */}
          {activeTab === "roadmap" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Roadmap</h2>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </div>

              <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                {/* Planned */}
                <div>
                  <div className="bg-gray-50 rounded-t-lg p-4 border-l-4 border-teal-500">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-teal-500" />
                      Planned
                    </h3>
                  </div>
                  <div className="bg-white rounded-b-lg border border-gray-200 p-4 space-y-4">
                    {roadmapItems
                      .filter((item) => item.status === "planned")
                      .map((item) => (
                        <div
                          key={item.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              {item.votes}
                            </Button>
                          </div>
                          <h4
                            className="font-medium text-gray-900 mb-2 cursor-pointer hover:text-green-600 transition-colors"
                            onClick={() => navigate(`/ideas/r${item.id}`)}
                          >
                            {item.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            {item.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                            {item.estimatedCompletion && (
                              <span className="text-xs text-gray-500">
                                {new Date(
                                  item.estimatedCompletion,
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* In Progress */}
                <div>
                  <div className="bg-gray-50 rounded-t-lg p-4 border-l-4 border-purple-500">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Code className="h-5 w-5 text-purple-500" />
                      In Progress
                    </h3>
                  </div>
                  <div className="bg-white rounded-b-lg border border-gray-200 p-4 space-y-4">
                    {roadmapItems
                      .filter((item) => item.status === "in-progress")
                      .map((item) => (
                        <div
                          key={item.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              {item.votes}
                            </Button>
                          </div>
                          <h4
                            className="font-medium text-gray-900 mb-2 cursor-pointer hover:text-green-600 transition-colors"
                            onClick={() => navigate(`/ideas/r${item.id}`)}
                          >
                            {item.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            {item.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                            {item.estimatedCompletion && (
                              <span className="text-xs text-gray-500">
                                {new Date(
                                  item.estimatedCompletion,
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Completed */}
                <div>
                  <div className="bg-gray-50 rounded-t-lg p-4 border-l-4 border-green-500">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Completed
                    </h3>
                  </div>
                  <div className="bg-white rounded-b-lg border border-gray-200 p-4 space-y-4">
                    {roadmapItems
                      .filter((item) => item.status === "completed")
                      .map((item) => (
                        <div
                          key={item.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              {item.votes}
                            </Button>
                          </div>
                          <h4
                            className="font-medium text-gray-900 mb-2 cursor-pointer hover:text-green-600 transition-colors"
                            onClick={() => navigate(`/ideas/r${item.id}`)}
                          >
                            {item.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            {item.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                            <span className="text-xs text-green-600 font-medium">
                              ✓ Completed
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === "feedback" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedCategory
                      ? getCategoryName(selectedCategory)
                      : "All Ideas"}
                  </h2>
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      ← Back to all ideas
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {filteredIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Vote Section */}
                      <div className="flex sm:flex-col items-center sm:items-center justify-center sm:justify-start">
                        <Button
                          variant={idea.userVoted ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleVote(idea.id)}
                          className="h-8 px-2 text-xs"
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          {idea.votes}
                        </Button>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <h3
                              className="text-base sm:text-lg font-medium text-gray-900 mb-2 cursor-pointer hover:text-green-600 transition-colors"
                              onClick={() => navigate(`/ideas/${idea.id}`)}
                            >
                              {idea.title}
                            </h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                              {idea.description}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusBadge(idea.status)}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {idea.author}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {getCategoryName(idea.category)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            <span>{idea.comments.length} comments</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Changelog Tab */}
          {activeTab === "changelog" && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Changelog
              </h2>
              <div className="space-y-6">
                {changelogEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-lg border border-gray-200 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {entry.title}
                          </h3>
                          <Badge
                            variant={
                              entry.type === "feature"
                                ? "default"
                                : entry.type === "improvement"
                                  ? "secondary"
                                  : entry.type === "bugfix"
                                    ? "destructive"
                                    : "outline"
                            }
                            className="text-xs"
                          >
                            {entry.type}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">
                          {entry.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          v{entry.version}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(entry.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {entry.items.map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

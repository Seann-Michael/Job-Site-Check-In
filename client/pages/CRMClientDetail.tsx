import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { AgencyLayout } from "../components/AgencyLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  UserCheck,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Activity,
  CheckSquare,
  Plus,
  Edit,
  FileText,
  MessageSquare,
  Clock,
  Target,
  Map,
  Upload,
  Download,
  Trash2,
  ArrowLeft,
} from "lucide-react";

interface CRMClient {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  industry: string;
  business_size: string;
  status: string;
  monthly_retainer: number;
  services_provided: string[];
  contract_start_date: string;
  contract_end_date: string;
  last_contact_date: string;
  next_follow_up_date: string;
  tags: string[];
  created_at: string;
}

interface Activity {
  id: string;
  activity_type: string;
  title: string;
  description: string;
  created_at: string;
  user_name: string;
  is_important: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  assigned_to_name: string;
  created_at: string;
}

interface GeoScan {
  id: string;
  scan_name: string;
  scan_date: string;
  scan_data: any;
}

const statusColors = {
  prospect: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

export default function CRMClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<CRMClient | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [geoScans, setGeoScans] = useState<GeoScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // New activity form
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [newActivity, setNewActivity] = useState({
    activity_type: "note",
    title: "",
    description: "",
  });

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  useEffect(() => {
    if (clientId) {
      loadClient();
      loadActivities();
      loadTasks();
      loadGeoScans();
    }
  }, [clientId]);

  const loadClient = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/crm/clients/${clientId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClient(data.client);
      }
    } catch (error) {
      console.error("Error loading client:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/crm/clients/${clientId}/activities`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Error loading activities:", error);
    }
  };

  const loadTasks = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/crm/clients/${clientId}/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  };

  const loadGeoScans = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/crm/clients/${clientId}/geo-scans`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGeoScans(data.scans || []);
      }
    } catch (error) {
      console.error("Error loading geo scans:", error);
    }
  };

  const createActivity = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/crm/clients/${clientId}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newActivity),
      });

      if (response.ok) {
        setShowNewActivity(false);
        setNewActivity({ activity_type: "note", title: "", description: "" });
        loadActivities();
      }
    } catch (error) {
      console.error("Error creating activity:", error);
    }
  };

  const createTask = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(`/api/crm/clients/${clientId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTask),
      });

      if (response.ok) {
        setShowNewTask(false);
        setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
        loadTasks();
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <AgencyLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AgencyLayout>
    );
  }

  if (!client) {
    return (
      <AgencyLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold">Client not found</h2>
            <p className="text-muted-foreground">The client you're looking for doesn't exist.</p>
            <Link to="/agency/admin/crm">
              <Button className="mt-4">Back to CRM</Button>
            </Link>
          </div>
        </div>
      </AgencyLayout>
    );
  }

  return (
    <AgencyLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/agency/admin/crm">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to CRM
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{client.company_name}</h1>
                <Badge className={statusColors[client.status as keyof typeof statusColors]}>
                  {client.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">{client.contact_name}</p>
            </div>
          </div>
          <Link to={`/admin/crm/clients/${client.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Client
            </Button>
          </Link>
        </div>

        {/* Client Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Monthly Retainer</p>
                  <p className="text-xl font-bold">
                    {client.monthly_retainer ? formatCurrency(client.monthly_retainer) : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Contract Start</p>
                  <p className="text-lg font-semibold">{formatDate(client.contract_start_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Last Contact</p>
                  <p className="text-lg font-semibold">{formatDate(client.last_contact_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium">Next Follow-up</p>
                  <p className="text-lg font-semibold">{formatDate(client.next_follow_up_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activities">
              Activities ({activities.length})
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="geo-scans">
              Geo Scans ({geoScans.length})
            </TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Industry</p>
                      <p className="text-sm text-muted-foreground">{client.industry || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Business Size</p>
                      <p className="text-sm text-muted-foreground">{client.business_size || "—"}</p>
                    </div>
                  </div>
                  
                  {client.website && (
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <a 
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3" />
                        {client.website}
                      </a>
                    </div>
                  )}

                  {(client.address_line1 || client.city) && (
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <div className="text-sm text-muted-foreground">
                        {client.address_line1 && <div>{client.address_line1}</div>}
                        {client.address_line2 && <div>{client.address_line2}</div>}
                        {(client.city || client.state || client.zip_code) && (
                          <div>
                            {client.city}, {client.state} {client.zip_code}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                        {client.email}
                      </a>
                    </div>
                  )}
                  
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                        {client.phone}
                      </a>
                    </div>
                  )}

                  {client.services_provided && client.services_provided.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Services Provided</p>
                      <div className="flex flex-wrap gap-2">
                        {client.services_provided.map((service, index) => (
                          <Badge key={index} variant="outline">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {client.tags && client.tags.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {client.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Recent Activities</h3>
              <Dialog open={showNewActivity} onOpenChange={setShowNewActivity}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Activity
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Activity</DialogTitle>
                    <DialogDescription>
                      Record a new activity for this client
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Activity Type</Label>
                      <Select 
                        value={newActivity.activity_type} 
                        onValueChange={(value) => setNewActivity(prev => ({ ...prev, activity_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="note">Note</SelectItem>
                          <SelectItem value="call">Phone Call</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={newActivity.title}
                        onChange={(e) => setNewActivity(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Activity title..."
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={newActivity.description}
                        onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Activity details..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createActivity}>Create Activity</Button>
                      <Button variant="outline" onClick={() => setShowNewActivity(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-6">
                {activities.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-medium mb-2">No activities yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start tracking your interactions with this client
                    </p>
                    <Button onClick={() => setShowNewActivity(true)}>
                      Add First Activity
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="border-l-2 border-blue-200 pl-4 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{activity.title}</h4>
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {activity.activity_type}
                              </Badge>
                              <span>•</span>
                              <span>{formatDate(activity.created_at)}</span>
                              <span>•</span>
                              <span>by {activity.user_name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Client Tasks</h3>
              <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                    <DialogDescription>
                      Create a new task for this client
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Task Title</Label>
                      <Input
                        value={newTask.title}
                        onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Task title..."
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={newTask.description}
                        onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Task description..."
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Priority</Label>
                        <Select 
                          value={newTask.priority} 
                          onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value }))}
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
                      <div>
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={newTask.due_date}
                          onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createTask}>Create Task</Button>
                      <Button variant="outline" onClick={() => setShowNewTask(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-6">
                {tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-medium mb-2">No tasks yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create tasks to track work for this client
                    </p>
                    <Button onClick={() => setShowNewTask(true)}>
                      Create First Task
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((task) => (
                      <div key={task.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
                                {task.priority}
                              </Badge>
                              <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>
                                {task.status}
                              </Badge>
                              {task.due_date && (
                                <span className="text-xs text-muted-foreground">
                                  Due: {formatDate(task.due_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Geo Scans Tab */}
          <TabsContent value="geo-scans" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Geo Grid Scans</h3>
              <Link to={`/admin/maps/geo-grid-scan?client=${client.id}`}>
                <Button>
                  <Map className="h-4 w-4 mr-2" />
                  Run New Scan
                </Button>
              </Link>
            </div>

            <Card>
              <CardContent className="p-6">
                {geoScans.length === 0 ? (
                  <div className="text-center py-8">
                    <Map className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-medium mb-2">No geo scans yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Run geo grid scans to track this client's local visibility
                    </p>
                    <Link to={`/admin/maps/geo-grid-scan?client=${client.id}`}>
                      <Button>Run First Scan</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {geoScans.map((scan) => (
                      <div key={scan.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{scan.scan_name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Scanned on {formatDate(scan.scan_date)}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">
                            View Results
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Client Documents</h3>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium mb-2">No documents yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload contracts, proposals, and other client documents
                  </p>
                  <Button>Upload First Document</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AgencyLayout>
  );
}

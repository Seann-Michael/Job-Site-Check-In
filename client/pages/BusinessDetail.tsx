import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Activity,
  Database,
  Building2,
  Edit,
  Trash2,
  Camera,
  Video,
  FolderOpen,
  DollarSign,
  Calendar,
  Clock,
  Save,
  X,
  Plus,
  LogIn,
  Key,
  Smartphone,
  Monitor,
  MapPin,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface BusinessUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "Active" | "Inactive";
  lastLogin: string;
  photosUploaded: number;
  videosUploaded: number;
  projectsCreated: number;
  joinedDate: string;
}

interface ActivityLog {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  details?: string;
}

interface FinancialRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "charge" | "refund" | "credit";
  status: "completed" | "pending" | "failed";
}

interface TimestampedNote {
  id: string;
  note: string;
  timestamp: string;
  adminUser: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  dueDate: string;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  transactionId: string;
  status: "completed" | "pending" | "failed";
}

export default function BusinessDetail() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BusinessUser | null>(null);
  const [newNote, setNewNote] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChangeUser, setPasswordChangeUser] =
    useState<BusinessUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");

  // Mock business data
  const [businessData, setBusinessData] = useState({
    id: businessId || "1",
    name: "Smith Construction LLC",
    adminFirstName: "John",
    adminLastName: "Smith",
    email: "john@smithconstruction.com",
    phone: "(555) 123-4567",
    address: "123 Main St, Springfield, IL 62701",
    plan: "Pro",
    status: "Active",
    signupDate: "2023-08-15",
    lastActivity: "2 hours ago",
    users: 8,
    photos: 1247,
    videos: 89,
    projects: 34,
    reviewsRequested: 156,
    storage: "2.4GB",
    storageLimit: "50GB",
    revenue: 348,
    billingDate: "15th of each month",
    lastFourCard: "4532",
    planDetails: {
      currentPlan: "Pro",
      monthlyPrice: 29,
      features: ["Unlimited Projects", "50GB Storage", "Priority Support"],
      nextBilling: "2024-02-15",
    },
  });

  const [users, setUsers] = useState<BusinessUser[]>([
    {
      id: "1",
      name: "John Smith",
      email: "john@smithconstruction.com",
      role: "admin",
      status: "Active",
      lastLogin: "2 hours ago",
      photosUploaded: 456,
      videosUploaded: 23,
      projectsCreated: 12,
      joinedDate: "2023-08-15",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@smithconstruction.com",
      role: "editor",
      status: "Active",
      lastLogin: "1 day ago",
      photosUploaded: 789,
      videosUploaded: 45,
      projectsCreated: 18,
      joinedDate: "2023-09-01",
    },
    {
      id: "3",
      name: "Mike Johnson",
      email: "mike@smithconstruction.com",
      role: "viewer",
      status: "Inactive",
      lastLogin: "1 week ago",
      photosUploaded: 2,
      videosUploaded: 21,
      projectsCreated: 4,
      joinedDate: "2023-10-15",
    },
  ]);

  const [activityLog] = useState<ActivityLog[]>([
    {
      id: "1",
      user: "John Smith",
      action: "Created new project",
      timestamp: "2 hours ago",
      details: "Kitchen Renovation - 123 Oak St",
    },
    {
      id: "2",
      user: "Jane Smith",
      action: "Uploaded 5 photos",
      timestamp: "4 hours ago",
      details: "Added to Bathroom Remodel project",
    },
    {
      id: "3",
      user: "John Smith",
      action: "Updated business profile",
      timestamp: "1 day ago",
      details: "Changed phone number",
    },
    {
      id: "4",
      user: "Mike Johnson",
      action: "Completed project",
      timestamp: "3 days ago",
      details: "Deck Installation - 456 Pine Ave",
    },
  ]);

  const [financialHistory] = useState<FinancialRecord[]>([
    {
      id: "1",
      date: "2024-01-15",
      description: "Pro Plan Subscription",
      amount: 29.0,
      type: "charge",
      status: "completed",
    },
    {
      id: "2",
      date: "2023-12-15",
      description: "Pro Plan Subscription",
      amount: 29.0,
      type: "charge",
      status: "completed",
    },
    {
      id: "3",
      date: "2023-11-15",
      description: "Pro Plan Subscription",
      amount: 29.0,
      type: "charge",
      status: "completed",
    },
    {
      id: "4",
      date: "2023-10-20",
      description: "Upgrade Credit",
      amount: -10.0,
      type: "credit",
      status: "completed",
    },
  ]);

  const [timestampedNotes, setTimestampedNotes] = useState<TimestampedNote[]>([
    {
      id: "1",
      note: "Great customer, always pays on time. Upgraded to Pro plan after 2 months.",
      timestamp: "2024-01-15T10:30:00Z",
      adminUser: "Admin User",
    },
    {
      id: "2",
      note: "Customer requested additional storage. Considering Enterprise upgrade.",
      timestamp: "2024-01-10T14:15:00Z",
      adminUser: "Admin User",
    },
  ]);

  const [invoices] = useState<Invoice[]>([
    {
      id: "1",
      invoiceNumber: "INV-2024-001",
      date: "2024-01-15",
      amount: 29.0,
      status: "paid",
      dueDate: "2024-01-30",
    },
    {
      id: "2",
      invoiceNumber: "INV-2023-012",
      date: "2023-12-15",
      amount: 29.0,
      status: "paid",
      dueDate: "2023-12-30",
    },
  ]);

  const [payments] = useState<Payment[]>([
    {
      id: "1",
      date: "2024-01-15",
      amount: 29.0,
      method: "Credit Card ****4532",
      transactionId: "txn_1234567890",
      status: "completed",
    },
    {
      id: "2",
      date: "2023-12-15",
      amount: 29.0,
      method: "Credit Card ****4532",
      transactionId: "txn_0987654321",
      status: "completed",
    },
  ]);

  const handleSaveBusiness = () => {
    setIsEditing(false);
    toast.success("Business details updated successfully");
  };

  const handleCancelPlan = () => {
    setBusinessData((prev) => ({ ...prev, status: "Canceled" }));
    toast.success("Plan canceled successfully");
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((user) => user.id !== userId));
    toast.success("User removed successfully");
  };

  const impersonateUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      toast.success(`Signing in as ${user.name}...`);
      localStorage.setItem(
        "superadmin_session",
        JSON.stringify({ id: "superadmin", role: "superadmin" }),
      );

      const impersonatedUser = {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        isImpersonated: true,
      };

      localStorage.setItem("auth_user", JSON.stringify(impersonatedUser));
      navigate("/admin/jobs", { replace: true });
    }
  };

  const addTimestampedNote = () => {
    if (!newNote.trim()) return;

    const note: TimestampedNote = {
      id: Date.now().toString(),
      note: newNote,
      timestamp: new Date().toISOString(),
      adminUser: "Current Admin",
    };

    setTimestampedNotes((prev) => [note, ...prev]);
    setNewNote("");
    toast.success("Note added successfully");
  };

  const editNote = (noteId: string, newText: string) => {
    setTimestampedNotes((prev) =>
      prev.map((note) =>
        note.id === noteId ? { ...note, note: newText } : note,
      ),
    );
    toast.success("Note updated successfully");
  };

  const deleteNote = (noteId: string) => {
    setTimestampedNotes((prev) => prev.filter((note) => note.id !== noteId));
    toast.success("Note deleted successfully");
  };

  const handlePasswordChange = () => {
    if (!passwordChangeUser || !newPassword) return;

    toast.success(`Password updated for ${passwordChangeUser.name}`);
    setShowPasswordChange(false);
    setNewPassword("");
    setPasswordChangeUser(null);
  };

  const handleUsernameChange = () => {
    if (!passwordChangeUser || !newUsername) return;

    setUsers((prev) =>
      prev.map((user) =>
        user.id === passwordChangeUser.id
          ? { ...user, email: newUsername }
          : user,
      ),
    );

    toast.success(`Username updated for ${passwordChangeUser.name}`);
    setShowPasswordChange(false);
    setNewUsername("");
    setPasswordChangeUser(null);
  };

  return (
    <SuperAdminLayout
      title={businessData.name}
      breadcrumbs={[
        { label: "Business Management", href: "/super-admin/businesses" },
        { label: businessData.name },
      ]}
    >
      <div className="space-y-6">
        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => impersonateUser("1")}
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            Sign In As Admin
          </Button>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Business
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSaveBusiness} className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* Business Overview Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Photos</p>
                  <p className="text-xl font-bold">{businessData.photos}</p>
                </div>
                <Camera className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Videos</p>
                  <p className="text-xl font-bold">{businessData.videos}</p>
                </div>
                <Video className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Projects</p>
                  <p className="text-xl font-bold">{businessData.projects}</p>
                </div>
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Reviews</p>
                  <p className="text-xl font-bold">
                    {businessData.reviewsRequested}
                  </p>
                </div>
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-xl font-bold">${businessData.revenue}</p>
                </div>
                <DollarSign className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Business Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Business Details
                <Badge
                  variant={
                    businessData.status === "Active"
                      ? "default"
                      : businessData.status === "Trial"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {businessData.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.name}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Admin First Name</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.adminFirstName}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          adminFirstName: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.adminFirstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Admin Last Name</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.adminLastName}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          adminLastName: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.adminLastName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={businessData.email}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.phone}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.phone}
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  {isEditing ? (
                    <Input
                      value={businessData.address}
                      onChange={(e) =>
                        setBusinessData((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">
                      {businessData.address}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Signup Date</Label>
                  <p className="text-sm p-2 bg-muted rounded">
                    {new Date(businessData.signupDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {businessData.status === "Active" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full gap-2 mt-4">
                      <X className="h-4 w-4" />
                      Cancel Plan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Plan</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel this business's plan?
                        This action cannot be undone and they will lose access
                        to premium features.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelPlan}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Yes, Cancel Plan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>

          {/* Plan Details */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Current Plan</span>
                <Badge variant="default">
                  {businessData.planDetails.currentPlan}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Monthly Price</span>
                <span className="font-bold">
                  ${businessData.planDetails.monthlyPrice}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Billing Date</span>
                <span className="text-sm">{businessData.billingDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Next Billing</span>
                <span className="text-sm">
                  {new Date(
                    businessData.planDetails.nextBilling,
                  ).toLocaleDateString()}
                </span>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Plan Features</h4>
                <ul className="space-y-1">
                  {businessData.planDetails.features.map((feature, index) => (
                    <li key={index} className="text-sm flex items-center gap-2">
                      <div className="h-1.5 w-1.5 bg-primary rounded-full"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Change Plan</Label>
                <Select
                  value={businessData.plan}
                  onValueChange={(value) =>
                    setBusinessData((prev) => ({ ...prev, plan: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Free">Free</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="text-sm">
                      **** **** **** {businessData.lastFourCard}
                    </span>
                  </div>
                  <Button variant="outline" size="sm">
                    Update
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "default"
                            : invoice.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>${payment.amount.toFixed(2)}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {payment.transactionId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "completed"
                            ? "default"
                            : payment.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Timestamped Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add an internal note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1"
              />
              <Button onClick={addTimestampedNote} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Note
              </Button>
            </div>
            <div className="space-y-3">
              {timestampedNotes.map((note) => (
                <div key={note.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <p className="text-sm flex-1">{note.note}</p>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newText = prompt("Edit note:", note.note);
                          if (newText !== null && newText.trim()) {
                            editNote(note.id, newText.trim());
                          }
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this note?",
                            )
                          ) {
                            deleteNote(note.id);
                          }
                        }}
                        className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                    <span>By: {note.adminUser}</span>
                    <span>{new Date(note.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>User Management ({users.length})</CardTitle>
              <Button className="gap-2" onClick={() => setShowAddUser(true)}>
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Content Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === "admin" ? "default" : "secondary"
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === "Active" ? "default" : "secondary"
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{user.photosUploaded} photos</div>
                        <div>{user.videosUploaded} videos</div>
                        <div>{user.projectsCreated} projects</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{user.lastLogin}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => impersonateUser(user.id)}
                          className="gap-1"
                        >
                          <LogIn className="h-3 w-3" />
                          Sign In As
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPasswordChangeUser(user);
                            setNewUsername(user.email);
                            setShowPasswordChange(true);
                          }}
                          className="gap-1"
                        >
                          <Key className="h-3 w-3" />
                          Credentials
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityLog.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user}</span>{" "}
                      {activity.action}
                    </p>
                    {activity.details && (
                      <p className="text-xs text-muted-foreground">
                        {activity.details}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Password/Username Change Dialog */}
        <Dialog open={showPasswordChange} onOpenChange={setShowPasswordChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Credentials</DialogTitle>
            </DialogHeader>
            {passwordChangeUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>User</Label>
                  <p className="text-sm p-2 bg-muted rounded">
                    {passwordChangeUser.name}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Username/Email</Label>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter new username/email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPasswordChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUsernameChange} disabled={!newUsername}>
                Update Username
              </Button>
              <Button onClick={handlePasswordChange} disabled={!newPassword}>
                Update Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}

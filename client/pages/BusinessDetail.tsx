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
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";
import { workspaceService } from "@/lib/workspaceService";
import { UserManagementSystem } from "@/components/UserManagementSystem";
import { getCurrentUser } from "@/lib/auth";

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
  const [newUsername, setNewUsername] = useState("");

  const [businessData, setBusinessData] = useState({
    id: businessId || "",
    name: "",
    adminFirstName: "",
    adminLastName: "",
    email: "",
    phone: "",
    address: "",
    plan: "",
    status: "",
    signupDate: "",
    lastActivity: "",
    users: 0,
    photos: 0,
    videos: 0,
    projects: 0,
    reviewsRequested: 0,
    storage: "—",
    storageLimit: "—",
    revenue: 0,
    billingDate: "—",
    lastFourCard: "",
    planDetails: {
      currentPlan: "",
      monthlyPrice: 0,
      features: [] as string[],
      nextBilling: "",
    },
  });
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const loadBusiness = async () => {
      setLoadingBusiness(true);
      try {
        const { data, error } = await supabaseClient
          .from("businesses")
          .select("*, owner:owner_id(name, email, phone)")
          .eq("id", businessId)
          .single();
        if (error) throw error;
        if (!data) throw new Error("Business not found");
        const ownerName: string = data.owner?.name ?? "";
        const nameParts = ownerName.split(" ");
        const addrObj = data.address as Record<string, string> | null;
        const addr = addrObj
          ? [addrObj.street, addrObj.city, addrObj.state].filter(Boolean).join(", ")
          : "";
        setBusinessData({
          id: data.id,
          name: data.name,
          adminFirstName: nameParts[0] ?? "",
          adminLastName: nameParts.slice(1).join(" "),
          email: data.owner?.email ?? data.email ?? "",
          phone: data.phone ?? "",
          address: addr,
          plan: (data.metadata as any)?.plan ?? "",
          status: data.status === "active" ? "Active" : data.status ?? "",
          signupDate: data.created_at ? new Date(data.created_at).toISOString().slice(0, 10) : "",
          lastActivity: data.updated_at ? new Date(data.updated_at).toLocaleDateString() : "—",
          users: 0, photos: 0, videos: 0, projects: 0, reviewsRequested: 0,
          storage: "—", storageLimit: "—", revenue: 0, billingDate: "—", lastFourCard: "",
          planDetails: { currentPlan: (data.metadata as any)?.plan ?? "", monthlyPrice: 0, features: [], nextBilling: "" },
        });
      } catch (err: any) {
        toast.error("Failed to load business: " + (err?.message ?? "Unknown error"));
      } finally {
        setLoadingBusiness(false);
      }
    };
    loadBusiness();
  }, [businessId]);

  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [activityLog] = useState<ActivityLog[]>([]);
  const [financialHistory] = useState<FinancialRecord[]>([]);
  const [timestampedNotes, setTimestampedNotes] = useState<TimestampedNote[]>([]);
  const [invoices] = useState<Invoice[]>([]);
  const [payments] = useState<Payment[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  // Load notes + users for this business from Supabase
  useEffect(() => {
    if (!businessId) return;
    const loadRelated = async () => {
      try {
        const [notesRes, usersRes] = await Promise.all([
          supabaseClient
            .from("business_notes")
            .select("*")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
          supabaseClient
            .from("users")
            .select("id, name, email, role, last_login, created_at")
            .eq("id",
              // sub-query: owner or any user associated with this business
              // We'll load the owner via the business, and also fetch users whose
              // metadata contains this business_id — for now load by business owner
              businessId
            ),
        ]);

        // Map notes
        const notes: TimestampedNote[] = (notesRes.data ?? []).map((r: any) => ({
          id: r.id,
          note: r.note,
          timestamp: r.created_at,
          adminUser: r.admin_user,
        }));
        setTimestampedNotes(notes);

        // Load users for this business via businesses.owner_id
        const { data: bizUsers } = await supabaseClient
          .from("users")
          .select("id, name, email, role, last_login, created_at, avatar_url")
          .in("id", [
            // We need to get all users that belong to this business
            // Since we don't have a direct user->business link table,
            // we load the owner from the business record
            businessId, // placeholder — will be filtered out if not a user
          ]);

        // Actually load via a join approach
        const { data: businessOwner } = await supabaseClient
          .from("businesses")
          .select("owner_id")
          .eq("id", businessId)
          .single();

        if (businessOwner?.owner_id) {
          const { data: ownerUser } = await supabaseClient
            .from("users")
            .select("id, name, email, role, last_login, created_at")
            .eq("id", businessOwner.owner_id)
            .single();

          if (ownerUser) {
            const mapped: BusinessUser = {
              id: ownerUser.id,
              name: ownerUser.name || ownerUser.email,
              email: ownerUser.email,
              role: (ownerUser.role === "business_owner" ? "admin" : ownerUser.role) as any,
              status: "Active",
              lastLogin: ownerUser.last_login
                ? new Date(ownerUser.last_login).toLocaleDateString()
                : "Never",
              photosUploaded: 0,
              videosUploaded: 0,
              projectsCreated: 0,
              joinedDate: ownerUser.created_at
                ? new Date(ownerUser.created_at).toLocaleDateString()
                : "Unknown",
            };
            setUsers([mapped]);
          }
        }
      } catch (err: any) {
        toast.error("Failed to load notes and users: " + (err?.message ?? "Unknown error"));
      }
    };
    loadRelated();
  }, [businessId]);

  const handleSaveBusiness = async () => {
    if (!businessId) return;
    try {
      const { error } = await supabaseClient
        .from("businesses")
        .update({
          name: businessData.name,
          phone: businessData.phone || null,
          email: businessData.email || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessId);
      if (error) throw error;
      setIsEditing(false);
      toast.success("Business details updated successfully");
    } catch (err: any) {
      toast.error("Failed to save: " + (err?.message ?? "Unknown error"));
    }
  };

  const handleCancelPlan = async () => {
    if (!businessId) return;
    try {
      const { error } = await supabaseClient
        .from("businesses")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", businessId);
      if (error) throw error;
      setBusinessData((prev) => ({ ...prev, status: "Canceled" }));
      toast.success("Plan canceled successfully");
    } catch (err: any) {
      toast.error("Failed to cancel plan: " + (err?.message ?? "Unknown error"));
    }
  };


  /**
   * Super admins have full access to every account: switch the workspace to
   * this business and open the regular admin UI.
   */
  const openAccount = async () => {
    if (!businessId) return;
    await workspaceService.whenReady();
    if (!workspaceService.getBusinessIds().includes(businessId)) {
      await workspaceService.reloadBusinesses();
    }
    if (!workspaceService.getBusinessIds().includes(businessId)) {
      toast.error("Could not open this account.");
      return;
    }
    await workspaceService.switchBusiness(businessId);
    navigate("/admin/jobs");
  };

  const addTimestampedNote = async () => {
    if (!newNote.trim() || !businessId) return;
    setSavingNote(true);
    try {
      const adminUser = getCurrentUser()?.name || "Super Admin";
      const { data, error } = await supabaseClient
        .from("business_notes")
        .insert({ business_id: businessId, note: newNote.trim(), admin_user: adminUser })
        .select()
        .single();
      if (error) throw error;
      const note: TimestampedNote = { id: data.id, note: data.note, timestamp: data.created_at, adminUser: data.admin_user };
      setTimestampedNotes((prev) => [note, ...prev]);
      setNewNote("");
      toast.success("Note added successfully");
    } catch (err: any) {
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const editNote = async (noteId: string, newText: string) => {
    try {
      const { error } = await supabaseClient
        .from("business_notes")
        .update({ note: newText, updated_at: new Date().toISOString() })
        .eq("id", noteId);
      if (error) throw error;
      setTimestampedNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, note: newText } : n));
      toast.success("Note updated successfully");
    } catch {
      toast.error("Failed to update note");
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabaseClient.from("business_notes").delete().eq("id", noteId);
      if (error) throw error;
      setTimestampedNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted successfully");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleUsernameChange = async () => {
    if (!passwordChangeUser || !newUsername) return;
    try {
      const { error } = await supabaseClient
        .from("users")
        .update({ email: newUsername, updated_at: new Date().toISOString() })
        .eq("id", passwordChangeUser.id);
      if (error) throw error;
      setUsers((prev) =>
        prev.map((user) =>
          user.id === passwordChangeUser.id
            ? { ...user, email: newUsername }
            : user,
        ),
      );
      toast.success(`Email updated for ${passwordChangeUser.name}`);
    } catch (err: any) {
      toast.error("Failed to update email: " + (err?.message ?? "Unknown error"));
    }
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
          <Button variant="outline" onClick={() => void openAccount()} className="gap-2">
            <LogIn className="h-4 w-4" />
            Open account
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

        {/* Team membership (owner + invited staff/viewers) */}
        {businessId && (
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <p className="text-sm text-muted-foreground">
                Invite, change roles for, or remove people on this account.
              </p>
            </CardHeader>
            <CardContent>
              <UserManagementSystem
                businessId={businessId}
                canManage
                embedded
              />
            </CardContent>
          </Card>
        )}

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

        {/* Username/Email Change Dialog */}
        <Dialog open={showPasswordChange} onOpenChange={setShowPasswordChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Email</DialogTitle>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}

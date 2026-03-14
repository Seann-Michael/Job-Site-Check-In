import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MoreVertical,
  Building2,
  Users,
  Eye,
  Ban,
  RefreshCw,
  LogIn,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

interface Agency {
  id: string;
  name: string;
  owner: string;
  email: string;
  clients: number;
  plan: "Starter" | "Growth" | "Agency" | "Enterprise";
  status: "Active" | "Trial" | "Suspended" | "Canceled";
  lastActivity: string;
  signupDate: string;
  revenue: number;
}

const mockAgencies: Agency[] = [
  {
    id: "1",
    name: "Apex Digital Agency",
    owner: "Lisa Martinez",
    email: "lisa@apexdigital.com",
    clients: 24,
    plan: "Agency",
    status: "Active",
    lastActivity: "1 hour ago",
    signupDate: "2023-07-10",
    revenue: 1497,
  },
  {
    id: "2",
    name: "Bright Media Group",
    owner: "Tom Harris",
    email: "tom@brightmedia.com",
    clients: 11,
    plan: "Growth",
    status: "Active",
    lastActivity: "3 hours ago",
    signupDate: "2023-09-02",
    revenue: 597,
  },
  {
    id: "3",
    name: "NorthStar Marketing",
    owner: "Carla Nguyen",
    email: "carla@northstarmarketing.com",
    clients: 38,
    plan: "Enterprise",
    status: "Active",
    lastActivity: "30 min ago",
    signupDate: "2023-04-18",
    revenue: 2997,
  },
  {
    id: "4",
    name: "GrowthPoint Agency",
    owner: "Derek Flynn",
    email: "derek@growthpoint.io",
    clients: 6,
    plan: "Starter",
    status: "Trial",
    lastActivity: "2 days ago",
    signupDate: "2024-01-15",
    revenue: 0,
  },
  {
    id: "5",
    name: "Redline Creative",
    owner: "Jasmine Park",
    email: "jasmine@redlinecreative.com",
    clients: 0,
    plan: "Growth",
    status: "Suspended",
    lastActivity: "2 weeks ago",
    signupDate: "2023-11-20",
    revenue: 297,
  },
];

const STATUS_COLORS: Record<Agency["status"], string> = {
  Active: "bg-green-100 text-green-700",
  Trial: "bg-blue-100 text-blue-700",
  Suspended: "bg-red-100 text-red-700",
  Canceled: "bg-gray-100 text-gray-600",
};

const PLAN_COLORS: Record<Agency["plan"], string> = {
  Starter: "bg-slate-100 text-slate-700",
  Growth: "bg-purple-100 text-purple-700",
  Agency: "bg-indigo-100 text-indigo-700",
  Enterprise: "bg-amber-100 text-amber-700",
};

export default function SuperAdminAgencyManagement() {
  const [agencies, setAgencies] = useState<Agency[]>(mockAgencies);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = agencies.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.owner.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || a.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSuspend = (id: string) => {
    setAgencies((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === "Suspended" ? "Active" : "Suspended" } : a,
      ),
    );
    const agency = agencies.find((a) => a.id === id);
    toast.success(
      agency?.status === "Suspended"
        ? `${agency.name} reactivated.`
        : `${agency?.name} suspended.`,
    );
  };

  const handleImpersonate = (agency: Agency) => {
    toast.info(`Impersonating ${agency.name} — feature coming soon.`);
  };

  const handleEmail = (agency: Agency) => {
    toast.info(`Opening email to ${agency.email}…`);
  };

  const totals = {
    active: agencies.filter((a) => a.status === "Active").length,
    trial: agencies.filter((a) => a.status === "Trial").length,
    suspended: agencies.filter((a) => a.status === "Suspended").length,
    revenue: agencies.reduce((sum, a) => sum + a.revenue, 0),
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Agencies", value: totals.active, color: "text-green-600" },
          { label: "On Trial", value: totals.trial, color: "text-blue-600" },
          { label: "Suspended", value: totals.suspended, color: "text-red-600" },
          { label: "MRR", value: `$${totals.revenue.toLocaleString()}`, color: "text-primary" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agencies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => toast.info("Refreshing…")}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Agencies ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Clients</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No agencies found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((agency) => (
                <TableRow key={agency.id}>
                  <TableCell>
                    <div className="font-medium">{agency.name}</div>
                    <div className="text-sm text-muted-foreground">{agency.email}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[agency.plan]}`}>
                      {agency.plan}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[agency.status]}`}>
                      {agency.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {agency.clients}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {agency.revenue > 0 ? `$${agency.revenue.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {agency.lastActivity}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleImpersonate(agency)}>
                          <LogIn className="h-4 w-4 mr-2" />
                          Impersonate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEmail(agency)}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={agency.status === "Suspended" ? "text-green-600" : "text-red-600"}
                          onClick={() => handleSuspend(agency.id)}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          {agency.status === "Suspended" ? "Reactivate" : "Suspend"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

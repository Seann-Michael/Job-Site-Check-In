import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Trash,
  Star,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building,
  Users,
  TrendingUp,
  BarChart3,
  Zap,
  Calendar,
  RefreshCw,
  FileText,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import supabaseClient from "@/lib/supabaseClient";
import {
  GMBLead,
  GMBLeadDisplay,
  LeadFilters,
  LeadSortOptions,
  LeadStats,
  LEAD_QUALITY_OPTIONS,
  PRICE_RANGE_OPTIONS,
  GMB_CATEGORIES,
} from "@/types/leads";


const EMPTY_STATS: LeadStats = {
  total_leads: 0,
  unlocked_leads: 0,
  leads_by_quality: { hot: 0, warm: 0, cold: 0, unscored: 0 },
  leads_by_category: [],
  average_rating: 0,
  leads_with_phone: 0,
  leads_with_email: 0,
  leads_with_website: 0,
};

export default function SuperAdminLeads() {
  const [leads, setLeads] = useState<GMBLeadDisplay[]>([]);
  const [stats, setStats] = useState<LeadStats>(EMPTY_STATS);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<LeadFilters>({});
  const [sortOptions, setSortOptions] = useState<LeadSortOptions>({
    field: 'created_at',
    direction: 'desc',
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(25);

  // Fetch leads from gmb_profiles table
  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("gmb_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const mapped: GMBLeadDisplay[] = (data ?? []).map((p: any) => {
        const score = p.overall_score ?? 0;
        const quality = score >= 80 ? "hot" : score >= 60 ? "warm" : "cold";
        return {
          id: p.id,
          google_cid: p.place_id ?? p.id,
          business_name: p.business_name,
          phone: p.phone ?? "—",
          email: "—",
          website: p.website ?? "—",
          street_address: p.address ?? "—",
          city: "",
          state: "",
          zip_code: "",
          gmb_rating: p.rating ? Number(p.rating) : undefined,
          gmb_reviews_count: p.review_count ?? 0,
          gmb_category: p.types?.[0] ?? "—",
          gmb_verified: true,
          price_range: undefined,
          lead_score: score,
          lead_quality: quality as any,
          data_completeness_score: score,
          is_unlocked: true,
          unlock_credits_cost: 0,
          created_at: p.created_at ?? new Date().toISOString(),
          scan_location: p.address ?? undefined,
          found_position: undefined,
        };
      });
      setLeads(mapped);
      // Compute stats from real data
      const byQuality = { hot: 0, warm: 0, cold: 0, unscored: 0 };
      let totalRating = 0;
      let withPhone = 0; let withEmail = 0; let withWebsite = 0;
      mapped.forEach((l) => {
        if (l.lead_quality in byQuality) (byQuality as any)[l.lead_quality]++;
        if (l.gmb_rating) totalRating += l.gmb_rating;
        if (l.phone && l.phone !== "—") withPhone++;
        if (l.email && l.email !== "—") withEmail++;
        if (l.website && l.website !== "—") withWebsite++;
      });
      setStats({
        total_leads: mapped.length,
        unlocked_leads: mapped.filter(l => l.is_unlocked).length,
        leads_by_quality: byQuality,
        leads_by_category: [],
        average_rating: mapped.length ? +(totalRating / mapped.length).toFixed(1) : 0,
        leads_with_phone: withPhone,
        leads_with_email: withEmail,
        leads_with_website: withWebsite,
      });
    } catch (error: any) {
      toast.error("Failed to fetch leads: " + (error?.message ?? "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [filters, sortOptions, currentPage]);

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(leads.map(lead => lead.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;

    try {
      const ids = Array.from(selectedLeads);
      const { error } = await supabaseClient
        .from("gmb_profiles")
        .delete()
        .in("id", ids);
      if (error) throw error;
      setLeads(leads.filter(lead => !selectedLeads.has(lead.id)));
      setSelectedLeads(new Set());
      toast.success(`Deleted ${ids.length} leads`);
    } catch (error) {
      toast.error("Failed to delete leads");
    }
  };

  const handleBulkQualityUpdate = async (quality: string) => {
    if (selectedLeads.size === 0) return;

    // Map quality label to a representative overall_score
    const scoreByQuality: Record<string, number> = {
      hot: 85,
      warm: 70,
      cold: 40,
      unscored: 0,
    };
    const newScore = scoreByQuality[quality] ?? 0;

    try {
      const ids = Array.from(selectedLeads);
      const { error } = await supabaseClient
        .from("gmb_profiles")
        .update({ overall_score: newScore })
        .in("id", ids);
      if (error) throw error;
      setLeads(leads.map(lead =>
        selectedLeads.has(lead.id)
          ? { ...lead, lead_quality: quality as any, lead_score: newScore }
          : lead
      ));
      setSelectedLeads(new Set());
      toast.success(`Updated quality to "${quality}" for ${ids.length} leads`);
    } catch (error) {
      toast.error("Failed to update lead quality");
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const { error } = await supabaseClient.from("gmb_profiles").delete().eq("id", leadId);
      if (error) throw error;
      setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
      setSelectedLeads((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      toast.success("Lead deleted");
    } catch (error) {
      toast.error("Failed to delete lead");
    }
  };

  const handleSetLeadQuality = async (leadId: string, quality: string) => {
    const scoreByQuality: Record<string, number> = { hot: 85, warm: 70, cold: 40, unscored: 0 };
    const newScore = scoreByQuality[quality] ?? 0;
    try {
      const { error } = await supabaseClient
        .from("gmb_profiles")
        .update({ overall_score: newScore })
        .eq("id", leadId);
      if (error) throw error;
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, lead_quality: quality as any, lead_score: newScore } : lead,
        ),
      );
      toast.success(`Lead marked as ${quality}`);
    } catch (error) {
      toast.error("Failed to update lead quality");
    }
  };

  const handleExportLeads = async () => {
    try {
      const csvContent = "data:text/csv;charset=utf-8," 
        + "Business Name,Phone,Email,Website,City,State,Rating,Reviews,Category\n"
        + leads.map(lead => 
          `"${lead.business_name}","${lead.phone}","${lead.email}","${lead.website}","${lead.city}","${lead.state}",${lead.gmb_rating},${lead.gmb_reviews_count},"${lead.gmb_category}"`
        ).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `leads-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Leads exported successfully");
    } catch (error) {
      toast.error("Failed to export leads");
    }
  };

  const getQualityColor = (quality: string) => {
    const option = LEAD_QUALITY_OPTIONS.find(opt => opt.value === quality);
    return option?.color || 'gray';
  };

  const getQualityVariant = (quality: string) => {
    switch (quality) {
      case 'hot': return 'destructive';
      case 'warm': return 'default';
      case 'cold': return 'secondary';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
            <p className="text-gray-600">Manage all GMB leads from geo grid scans</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExportLeads}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Leads</p>
                  <p className="text-2xl font-bold">{stats.total_leads.toLocaleString()}</p>
                </div>
                <Building className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unlocked Leads</p>
                  <p className="text-2xl font-bold">{stats.unlocked_leads.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round((stats.unlocked_leads / stats.total_leads) * 100)}% unlocked
                  </p>
                </div>
                <Zap className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Rating</p>
                  <p className="text-2xl font-bold">{stats.average_rating}</p>
                  <div className="flex items-center mt-1">
                    <Star className="h-3 w-3 text-yellow-500 fill-current" />
                    <span className="text-xs text-gray-500 ml-1">Google Reviews</span>
                  </div>
                </div>
                <Star className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Hot Leads</p>
                  <p className="text-2xl font-bold">{stats.leads_by_quality.hot.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">High quality prospects</p>
                </div>
                <TrendingUp className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-1 items-center space-x-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" onClick={fetchLeads} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {selectedLeads.size > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedLeads.size} selected
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Quality Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {LEAD_QUALITY_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => handleBulkQualityUpdate(option.value)}
                        >
                          Mark as {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label>City</Label>
                    <Input
                      placeholder="Filter by city"
                      value={filters.city || ''}
                      onChange={(e) => setFilters({...filters, city: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input
                      placeholder="Filter by state"
                      value={filters.state || ''}
                      onChange={(e) => setFilters({...filters, state: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select
                      value={filters.gmb_category || ''}
                      onValueChange={(value) => setFilters({...filters, gmb_category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All categories</SelectItem>
                        {GMB_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Lead Quality</Label>
                    <Select
                      value={filters.lead_quality?.[0] || ''}
                      onValueChange={(value) => setFilters({...filters, lead_quality: value ? [value] : undefined})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All qualities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All qualities</SelectItem>
                        {LEAD_QUALITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setFilters({})}
                  >
                    Clear Filters
                  </Button>
                  <Button onClick={fetchLeads}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedLeads.size === leads.length && leads.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Found</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeads.has(lead.id)}
                          onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{lead.business_name}</div>
                          <div className="text-sm text-gray-500">
                            ID: {lead.google_cid.slice(-8)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {lead.phone && (
                            <div className="flex items-center text-sm">
                              <Phone className="h-3 w-3 mr-1" />
                              {lead.phone}
                            </div>
                          )}
                          {lead.email && (
                            <div className="flex items-center text-sm">
                              <Mail className="h-3 w-3 mr-1" />
                              {lead.email}
                            </div>
                          )}
                          {lead.website && (
                            <div className="flex items-center text-sm">
                              <Globe className="h-3 w-3 mr-1" />
                              Website
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center text-sm">
                            <MapPin className="h-3 w-3 mr-1" />
                            {lead.city}, {lead.state}
                          </div>
                          <div className="text-xs text-gray-500">{lead.zip_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.gmb_rating && (
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-500 fill-current mr-1" />
                            <span>{lead.gmb_rating}</span>
                            <span className="text-xs text-gray-500 ml-1">
                              ({lead.gmb_reviews_count})
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{lead.gmb_category}</div>
                          {lead.price_range && (
                            <div className="text-xs text-gray-500">{lead.price_range}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getQualityVariant(lead.lead_quality) as any}>
                          {LEAD_QUALITY_OPTIONS.find(opt => opt.value === lead.lead_quality)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium">{lead.lead_score}</div>
                          <Progress value={lead.data_completeness_score} className="w-16 h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {lead.is_unlocked ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Unlocked
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              Locked
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div>{lead.scan_location}</div>
                          <div className="text-gray-500">
                            Position #{lead.found_position}
                          </div>
                          <div className="text-gray-500">
                            {formatDate(lead.created_at)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Target className="h-4 w-4 mr-2" />
                                Set Quality
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {(["hot", "warm", "cold", "unscored"] as const).map((q) => (
                                  <DropdownMenuItem key={q} onClick={() => handleSetLeadQuality(lead.id, q)}>
                                    {q.charAt(0).toUpperCase() + q.slice(1)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteLead(lead.id)}
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, stats.total_leads)} of {stats.total_leads} leads
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {Math.ceil(stats.total_leads / perPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(stats.total_leads / perPage)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

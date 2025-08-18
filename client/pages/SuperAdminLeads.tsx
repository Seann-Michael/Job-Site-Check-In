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
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Upload,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
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

// Mock data for development
const mockLeads: GMBLeadDisplay[] = [
  {
    id: "1",
    google_cid: "12345678901234567890",
    business_name: "Joe's Pizza Palace",
    phone: "+1-555-0123",
    email: "contact@joespizza.com",
    website: "https://joespizza.com",
    street_address: "123 Main St",
    city: "New York",
    state: "NY",
    zip_code: "10001",
    gmb_rating: 4.5,
    gmb_reviews_count: 247,
    gmb_category: "Restaurant",
    gmb_verified: true,
    price_range: "$$",
    lead_score: 85,
    lead_quality: "hot",
    data_completeness_score: 92,
    is_unlocked: false,
    unlock_credits_cost: 5,
    created_at: "2024-01-15T10:00:00Z",
    scan_location: "Times Square, NY",
    found_position: 3,
  },
  {
    id: "2",
    google_cid: "09876543210987654321",
    business_name: "Elite Auto Repair",
    phone: "+1-555-0456",
    email: "info@eliteauto.com",
    website: "https://eliteauto.com",
    street_address: "456 Oak Ave",
    city: "Los Angeles",
    state: "CA",
    zip_code: "90210",
    gmb_rating: 4.8,
    gmb_reviews_count: 89,
    gmb_category: "Auto Repair",
    gmb_verified: true,
    price_range: "$$$",
    lead_score: 78,
    lead_quality: "warm",
    data_completeness_score: 87,
    is_unlocked: true,
    unlock_credits_cost: 5,
    created_at: "2024-01-14T14:30:00Z",
    scan_location: "Beverly Hills, CA",
    found_position: 1,
  },
  {
    id: "3",
    google_cid: "11111111111111111111",
    business_name: "Sunrise Dental Care",
    phone: "+1-555-0789",
    email: "appointments@sunrisedental.com",
    website: "https://sunrisedental.com",
    street_address: "789 Pine St",
    city: "Chicago",
    state: "IL",
    zip_code: "60601",
    gmb_rating: 4.2,
    gmb_reviews_count: 156,
    gmb_category: "Dentist",
    gmb_verified: false,
    price_range: "$$$",
    lead_score: 72,
    lead_quality: "warm",
    data_completeness_score: 94,
    is_unlocked: false,
    unlock_credits_cost: 5,
    created_at: "2024-01-13T09:15:00Z",
    scan_location: "Downtown Chicago, IL",
    found_position: 5,
  },
];

const mockStats: LeadStats = {
  total_leads: 15847,
  unlocked_leads: 3421,
  leads_by_quality: {
    hot: 2156,
    warm: 5847,
    cold: 4821,
    unscored: 3023,
  },
  leads_by_category: [
    { category: "Restaurant", count: 3245 },
    { category: "Auto Repair", count: 2156 },
    { category: "Real Estate", count: 1987 },
    { category: "Dentist", count: 1654 },
    { category: "Hair Salon", count: 1432 },
  ],
  average_rating: 4.2,
  leads_with_phone: 14523,
  leads_with_email: 12156,
  leads_with_website: 9876,
};

export default function SuperAdminLeads() {
  const [leads, setLeads] = useState<GMBLeadDisplay[]>(mockLeads);
  const [stats, setStats] = useState<LeadStats>(mockStats);
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

  // Fetch leads data
  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      // In real implementation, call your API here
      // const response = await fetch('/api/super-admin/leads', { ... });
      // setLeads(response.leads);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    } catch (error) {
      toast.error("Failed to fetch leads");
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
      // In real implementation, call delete API
      setLeads(leads.filter(lead => !selectedLeads.has(lead.id)));
      setSelectedLeads(new Set());
      toast.success(`Deleted ${selectedLeads.size} leads`);
    } catch (error) {
      toast.error("Failed to delete leads");
    }
  };

  const handleBulkQualityUpdate = async (quality: string) => {
    if (selectedLeads.size === 0) return;

    try {
      // In real implementation, call update API
      setLeads(leads.map(lead => 
        selectedLeads.has(lead.id) 
          ? { ...lead, lead_quality: quality as any }
          : lead
      ));
      setSelectedLeads(new Set());
      toast.success(`Updated quality for ${selectedLeads.size} leads`);
    } catch (error) {
      toast.error("Failed to update lead quality");
    }
  };

  const handleExportLeads = async () => {
    try {
      // In real implementation, generate CSV/Excel export
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
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Leads
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Leads</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Upload CSV File</Label>
                    <Input type="file" accept=".csv,.xlsx" />
                  </div>
                  <div className="text-sm text-gray-500">
                    Expected format: Business Name, Phone, Email, Website, Address, City, State, ZIP
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline">Cancel</Button>
                    <Button>Import</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Lead
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Target className="h-4 w-4 mr-2" />
                              Set Quality
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
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

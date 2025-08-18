import React, { useState, useEffect } from "react";
import { AgencyLayout } from "@/components/AgencyLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
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
  Download,
  MoreHorizontal,
  Eye,
  EyeOff,
  Star,
  MapPin,
  Building,
  Users,
  TrendingUp,
  BarChart3,
  Zap,
  RefreshCw,
  CreditCard,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShoppingCart,
  UserPlus,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  GMBLeadDisplay,
  LeadFilters,
  LeadSortOptions,
  LeadStats,
  BulkUnlockRequest,
  LEAD_QUALITY_OPTIONS,
  PRICE_RANGE_OPTIONS,
  GMB_CATEGORIES,
} from "@/types/leads";

// Mock data for agency context
const mockLeads: GMBLeadDisplay[] = [
  {
    id: "1",
    google_cid: "12345678901234567890",
    business_name: "***",
    phone: "***",
    email: "***",
    website: "***",
    street_address: "***",
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
];

const mockStats: LeadStats = {
  total_leads: 12563,
  unlocked_leads: 543,
  leads_by_quality: {
    hot: 1756,
    warm: 4347,
    cold: 3847,
    unscored: 2613,
  },
  leads_by_category: [
    { category: "Restaurant", count: 2145 },
    { category: "Auto Repair", count: 1856 },
    { category: "Real Estate", count: 1587 },
    { category: "Dentist", count: 1254 },
    { category: "Hair Salon", count: 1032 },
  ],
  average_rating: 4.3,
  leads_with_phone: 11423,
  leads_with_email: 8756,
  leads_with_website: 6534,
};

interface AgencyCredits {
  current_credits: 256;
  total_purchased: 1000;
  total_spent: 744;
  monthly_allocation: 500;
  used_this_month: 256;
}

const mockAgencyCredits: AgencyCredits = {
  current_credits: 256,
  total_purchased: 1000,
  total_spent: 744,
  monthly_allocation: 500,
  used_this_month: 256,
};

export default function AgencyLeads() {
  const [leads, setLeads] = useState<GMBLeadDisplay[]>(mockLeads);
  const [stats, setStats] = useState<LeadStats>(mockStats);
  const [agencyCredits, setAgencyCredits] = useState<AgencyCredits>(mockAgencyCredits);
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
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [bulkUnlockLeads, setBulkUnlockLeads] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState("");

  // Mock client list for agency
  const mockClients = [
    { id: "client-1", name: "ABC Marketing Corp", email: "contact@abcmarketing.com" },
    { id: "client-2", name: "XYZ Real Estate", email: "info@xyzrealestate.com" },
    { id: "client-3", name: "Local Business Hub", email: "hello@localbusinesshub.com" },
  ];

  // Fetch leads data
  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      // In real implementation, call your API here
      // const response = await fetch('/api/agency/leads', { ... });
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
      // Only select unlockable (locked) leads
      const unlockableLeads = leads.filter(lead => !lead.is_unlocked).map(lead => lead.id);
      setSelectedLeads(new Set(unlockableLeads));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleUnlockLead = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.is_unlocked) return;

    if (agencyCredits.current_credits < lead.unlock_credits_cost) {
      toast.error("Insufficient credits to unlock this lead");
      return;
    }

    try {
      // In real implementation, call unlock API
      setLeads(leads.map(l => 
        l.id === leadId 
          ? { 
              ...l, 
              is_unlocked: true,
              business_name: "Joe's Pizza Palace", // Reveal actual data
              phone: "+1-555-0123",
              email: "contact@joespizza.com",
              website: "https://joespizza.com",
              street_address: "123 Main St",
            }
          : l
      ));
      
      setAgencyCredits({
        ...agencyCredits,
        current_credits: agencyCredits.current_credits - lead.unlock_credits_cost,
        total_spent: agencyCredits.total_spent + lead.unlock_credits_cost,
        used_this_month: agencyCredits.used_this_month + lead.unlock_credits_cost,
      });
      
      toast.success(`Lead unlocked! ${lead.unlock_credits_cost} credits used`);
    } catch (error) {
      toast.error("Failed to unlock lead");
    }
  };

  const handleBulkUnlock = async () => {
    const selectedUnlockedLeads = leads.filter(lead => 
      selectedLeads.has(lead.id) && !lead.is_unlocked
    );
    
    if (selectedUnlockedLeads.length === 0) {
      toast.error("No locked leads selected");
      return;
    }

    const totalCost = selectedUnlockedLeads.reduce((sum, lead) => sum + lead.unlock_credits_cost, 0);
    
    if (agencyCredits.current_credits < totalCost) {
      toast.error(`Insufficient credits. Need ${totalCost}, have ${agencyCredits.current_credits}`);
      return;
    }

    setBulkUnlockLeads(selectedUnlockedLeads.map(lead => lead.id));
    setShowUnlockDialog(true);
  };

  const confirmBulkUnlock = async () => {
    const selectedUnlockedLeads = leads.filter(lead => 
      bulkUnlockLeads.includes(lead.id) && !lead.is_unlocked
    );
    
    const totalCost = selectedUnlockedLeads.reduce((sum, lead) => sum + lead.unlock_credits_cost, 0);

    try {
      // In real implementation, call bulk unlock API
      setLeads(leads.map(lead => 
        bulkUnlockLeads.includes(lead.id) && !lead.is_unlocked
          ? { 
              ...lead, 
              is_unlocked: true,
              business_name: "Sample Business Name", // Reveal actual data
              phone: "+1-555-XXXX",
              email: "contact@business.com",
              website: "https://business.com",
              street_address: "123 Sample St",
            }
          : lead
      ));
      
      setAgencyCredits({
        ...agencyCredits,
        current_credits: agencyCredits.current_credits - totalCost,
        total_spent: agencyCredits.total_spent + totalCost,
        used_this_month: agencyCredits.used_this_month + totalCost,
      });
      
      setSelectedLeads(new Set());
      setShowUnlockDialog(false);
      setBulkUnlockLeads([]);
      
      toast.success(`${selectedUnlockedLeads.length} leads unlocked! ${totalCost} credits used`);
    } catch (error) {
      toast.error("Failed to unlock leads");
    }
  };

  const handleAssignToClient = async () => {
    if (!selectedClient) {
      toast.error("Please select a client");
      return;
    }

    const selectedUnlockedLeads = leads.filter(lead => 
      selectedLeads.has(lead.id) && lead.is_unlocked
    );

    if (selectedUnlockedLeads.length === 0) {
      toast.error("No unlocked leads selected");
      return;
    }

    try {
      // In real implementation, call assign API
      const client = mockClients.find(c => c.id === selectedClient);
      toast.success(`${selectedUnlockedLeads.length} leads assigned to ${client?.name}`);
      setSelectedLeads(new Set());
      setShowAssignDialog(false);
      setSelectedClient("");
    } catch (error) {
      toast.error("Failed to assign leads");
    }
  };

  const handleExportUnlocked = async () => {
    const unlockedLeads = leads.filter(lead => lead.is_unlocked);
    
    if (unlockedLeads.length === 0) {
      toast.error("No unlocked leads to export");
      return;
    }

    try {
      const csvContent = "data:text/csv;charset=utf-8," 
        + "Business Name,Phone,Email,Website,City,State,Rating,Reviews,Category\n"
        + unlockedLeads.map(lead => 
          `"${lead.business_name}","${lead.phone}","${lead.email}","${lead.website}","${lead.city}","${lead.state}",${lead.gmb_rating},${lead.gmb_reviews_count},"${lead.gmb_category}"`
        ).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `agency-unlocked-leads-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Unlocked leads exported successfully");
    } catch (error) {
      toast.error("Failed to export leads");
    }
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

  const selectedLockedLeads = leads.filter(lead => 
    selectedLeads.has(lead.id) && !lead.is_unlocked
  );
  const selectedUnlockedLeads = leads.filter(lead => 
    selectedLeads.has(lead.id) && lead.is_unlocked
  );
  const totalUnlockCost = selectedLockedLeads.reduce((sum, lead) => sum + lead.unlock_credits_cost, 0);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Database</h1>
            <p className="text-gray-600">Access premium leads for your agency clients</p>
          </div>
          <div className="flex items-center space-x-2">
            <Card className="px-4 py-2">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{agencyCredits.current_credits}</span>
                <span className="text-sm text-gray-500">credits</span>
                <div className="text-xs text-gray-400">
                  ({agencyCredits.used_this_month}/{agencyCredits.monthly_allocation} used this month)
                </div>
              </div>
            </Card>
            <Button variant="outline" onClick={handleExportUnlocked}>
              <Download className="h-4 w-4 mr-2" />
              Export Unlocked
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available Leads</p>
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
                  <p className="text-sm text-gray-600">Agency Unlocked</p>
                  <p className="text-2xl font-bold">{stats.unlocked_leads.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Ready for clients</p>
                </div>
                <Unlock className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Monthly Budget</p>
                  <p className="text-2xl font-bold">{agencyCredits.monthly_allocation}</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full" 
                      style={{width: `${(agencyCredits.used_this_month / agencyCredits.monthly_allocation) * 100}%`}}
                    ></div>
                  </div>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600" />
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
                    placeholder="Search by category, location..."
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
                <div className="flex items-center space-x-2 flex-wrap gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedLeads.size} leads selected
                  </span>
                  
                  {totalUnlockCost > 0 && (
                    <Button
                      onClick={handleBulkUnlock}
                      disabled={agencyCredits.current_credits < totalUnlockCost}
                      className="bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Unlock ({totalUnlockCost} credits)
                    </Button>
                  )}
                  
                  {selectedUnlockedLeads.length > 0 && (
                    <Button
                      onClick={() => setShowAssignDialog(true)}
                      variant="default"
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign to Client
                    </Button>
                  )}
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
                    <Label>Unlock Status</Label>
                    <Select
                      value={filters.unlocked_status || 'all'}
                      onValueChange={(value) => setFilters({...filters, unlocked_status: value as any})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All leads" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All leads</SelectItem>
                        <SelectItem value="locked">Locked only</SelectItem>
                        <SelectItem value="unlocked">Unlocked only</SelectItem>
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
                        checked={selectedLeads.size > 0 && selectedLockedLeads.length === leads.filter(l => !l.is_unlocked).length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
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
                          <div className="font-medium flex items-center">
                            {lead.business_name}
                            {!lead.is_unlocked && (
                              <Lock className="h-3 w-3 ml-2 text-gray-400" />
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {lead.google_cid.slice(-8)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            {lead.is_unlocked ? (
                              <span>{lead.phone}</span>
                            ) : (
                              <span className="flex items-center">
                                <EyeOff className="h-3 w-3 mr-2 text-gray-400" />
                                Phone hidden
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-sm">
                            {lead.is_unlocked ? (
                              <span>{lead.email}</span>
                            ) : (
                              <span className="flex items-center">
                                <EyeOff className="h-3 w-3 mr-2 text-gray-400" />
                                Email hidden
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-sm">
                            {lead.is_unlocked ? (
                              <span>Website available</span>
                            ) : (
                              <span className="flex items-center">
                                <EyeOff className="h-3 w-3 mr-2 text-gray-400" />
                                Website hidden
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center text-sm">
                            <MapPin className="h-3 w-3 mr-1" />
                            {lead.city}, {lead.state}
                          </div>
                          <div className="text-xs text-gray-500">{lead.zip_code}</div>
                          {!lead.is_unlocked && (
                            <div className="text-xs text-gray-400 flex items-center mt-1">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Full address hidden
                            </div>
                          )}
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
                              <Lock className="h-3 w-3 mr-1" />
                              {lead.unlock_credits_cost} credits
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {!lead.is_unlocked ? (
                            <Button
                              size="sm"
                              onClick={() => handleUnlockLead(lead.id)}
                              disabled={agencyCredits.current_credits < lead.unlock_credits_cost}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Unlock className="h-3 w-3 mr-1" />
                              Unlock
                            </Button>
                          ) : (
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
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Assign to Client
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Send className="h-4 w-4 mr-2" />
                                  Send to Client
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Download className="h-4 w-4 mr-2" />
                                  Export Contact
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
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

        {/* Bulk Unlock Confirmation Dialog */}
        <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bulk Unlock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">Unlock {bulkUnlockLeads.length} leads?</p>
                  <p className="text-sm text-gray-600">
                    This will cost {totalUnlockCost} credits and reveal all contact information.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Current Credits:</span>
                  <span className="font-medium ml-2">{agencyCredits.current_credits}</span>
                </div>
                <div>
                  <span className="text-gray-500">After Unlock:</span>
                  <span className="font-medium ml-2">{agencyCredits.current_credits - totalUnlockCost}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnlockDialog(false)}>
                Cancel
              </Button>
              <Button onClick={confirmBulkUnlock} className="bg-blue-600 hover:bg-blue-700">
                Confirm Unlock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign to Client Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Leads to Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="font-medium">Assign {selectedUnlockedLeads.length} unlocked leads</p>
                <p className="text-sm text-gray-600">
                  These leads will be shared with the selected client.
                </p>
              </div>
              <div>
                <Label>Select Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignToClient}>
                Assign Leads
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

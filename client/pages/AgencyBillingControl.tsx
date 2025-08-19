import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  CreditCard,
  Users,
  Settings,
  History,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Building2,
  DollarSign,
  Plus,
  Eye,
  Trash2,
  Send,
  UserPlus,
  Wallet,
} from 'lucide-react';

interface BillingRelationship {
  id: string;
  admin_user_id: string;
  agency_user_id: string;
  billing_arrangement: 'admin_direct' | 'agency_sponsored' | 'agency_allocated';
  monthly_credit_allocation: number;
  billing_start_date: string;
  billing_end_date?: string;
  status: 'active' | 'admin_ejected' | 'agency_ejected' | 'mutual_terminated' | 'expired';
  created_at: string;
  terminated_at?: string;
  terminated_by?: string;
  termination_reason?: string;
  admin_profile: {
    full_name: string;
    company: string;
  };
}

interface BillingHistory {
  id: string;
  event_type: string;
  previous_arrangement?: string;
  new_arrangement?: string;
  amount_cents?: number;
  credits_transferred?: number;
  currency: string;
  created_at: string;
  metadata: any;
}

interface AgencyBillingSettings {
  agency_user_id: string;
  can_sponsor_admins: boolean;
  max_sponsored_admins: number;
  monthly_admin_budget_cents?: number;
  auto_allocate_credits: boolean;
  default_monthly_allocation: number;
  auto_terminate_on_budget_exceeded: boolean;
  stripe_customer_id?: string;
  default_payment_method_id?: string;
}

interface NewRelationshipForm {
  adminUserId: string;
  billingArrangement: 'agency_sponsored' | 'agency_allocated';
  monthlyCreditsAllocation: number;
  billingEndDate?: string;
}

export default function AgencyBillingControl() {
  const { user, token } = useAuth();
  const [relationships, setRelationships] = useState<BillingRelationship[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [settings, setSettings] = useState<AgencyBillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRelationship, setSelectedRelationship] = useState<BillingRelationship | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showAllocationSettingsDialog, setShowAllocationSettingsDialog] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [allocationSettings, setAllocationSettings] = useState({
    autoAllocateEnabled: true,
    monthlyCreditsAllocation: 100,
    allocationDayOfMonth: 1,
  });
  const [newRelationship, setNewRelationship] = useState<NewRelationshipForm>({
    adminUserId: '',
    billingArrangement: 'agency_sponsored',
    monthlyCreditsAllocation: 100,
  });

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!token) return;

    try {
      setLoading(true);
      
      // Load relationships
      const relationshipsResponse = await fetch('/api/billing/admin-agency/relationships', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (relationshipsResponse.ok) {
        const relationshipsData = await relationshipsResponse.json();
        setRelationships(relationshipsData.relationships || []);
      }

      // Load settings
      const settingsResponse = await fetch('/api/billing/admin-agency/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings(settingsData.settings);
      }

    } catch (error) {
      console.error('Error loading billing data:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const loadRelationshipHistory = async (relationshipId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/billing/admin-agency/history?relationshipId=${relationshipId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBillingHistory(data.history || []);
      } else {
        throw new Error('Failed to load history');
      }
    } catch (error) {
      console.error('Error loading billing history:', error);
      toast.error('Failed to load billing history');
    }
  };

  const updateSettings = async (newSettings: Partial<AgencyBillingSettings>) => {
    if (!token) return;

    try {
      const response = await fetch('/api/billing/admin-agency/update-preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('Settings updated successfully');
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const createRelationship = async () => {
    if (!token || !newRelationship.adminUserId) return;

    try {
      const response = await fetch('/api/billing/admin-agency/create-relationship', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: newRelationship.adminUserId,
          agencyUserId: user?.id,
          billingArrangement: newRelationship.billingArrangement,
          monthlyCreditsAllocation: newRelationship.monthlyCreditsAllocation,
          billingEndDate: newRelationship.billingEndDate || null,
        }),
      });

      if (response.ok) {
        toast.success('Billing relationship created successfully');
        setShowCreateDialog(false);
        setNewRelationship({
          adminUserId: '',
          billingArrangement: 'agency_sponsored',
          monthlyCreditsAllocation: 100,
        });
        loadData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create relationship');
      }
    } catch (error) {
      console.error('Error creating relationship:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create relationship');
    }
  };

  const terminateRelationship = async () => {
    if (!selectedRelationship || !token) return;

    try {
      const response = await fetch('/api/billing/admin-agency/terminate-relationship', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          relationshipId: selectedRelationship.id,
          terminationReason,
          newStatus: 'agency_ejected',
        }),
      });

      if (response.ok) {
        toast.success('Relationship terminated successfully');
        setShowTerminateDialog(false);
        setSelectedRelationship(null);
        setTerminationReason('');
        loadData();
      } else {
        throw new Error('Failed to terminate relationship');
      }
    } catch (error) {
      console.error('Error terminating relationship:', error);
      toast.error('Failed to terminate relationship');
    }
  };

  const transferCredits = async () => {
    if (!selectedRelationship || !token || !transferAmount) return;

    try {
      const creditsAmount = parseInt(transferAmount);
      if (isNaN(creditsAmount) || creditsAmount <= 0) {
        toast.error('Please enter a valid credit amount');
        return;
      }

      const response = await fetch('/api/credit-allocation/manual-allocation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          relationshipId: selectedRelationship.id,
          creditsAmount,
          allocationReason: 'Manual credit transfer',
        }),
      });

      if (response.ok) {
        toast.success(`Successfully transferred ${creditsAmount} credits`);
        setShowTransferDialog(false);
        setSelectedRelationship(null);
        setTransferAmount('');
        loadData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transfer credits');
      }
    } catch (error) {
      console.error('Error transferring credits:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to transfer credits');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'admin_ejected':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Admin Ejected</Badge>;
      case 'agency_ejected':
        return <Badge variant="destructive">Agency Ejected</Badge>;
      case 'mutual_terminated':
        return <Badge variant="outline">Terminated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getArrangementBadge = (arrangement: string) => {
    switch (arrangement) {
      case 'admin_direct':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Direct Billing</Badge>;
      case 'agency_sponsored':
        return <Badge variant="default" className="bg-green-50 text-green-700">Agency Sponsored</Badge>;
      case 'agency_allocated':
        return <Badge variant="secondary" className="bg-purple-50 text-purple-700">Credit Allocation</Badge>;
      default:
        return <Badge variant="outline">{arrangement}</Badge>;
    }
  };

  const totalMonthlyBudget = relationships
    .filter(r => r.status === 'active' && r.billing_arrangement !== 'admin_direct')
    .reduce((sum, r) => sum + r.monthly_credit_allocation, 0);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading billing information...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agency Billing Control</h1>
          <p className="text-muted-foreground">Manage billing relationships with your admin clients</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Admin
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Admins</p>
                <p className="text-2xl font-bold">{relationships.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {relationships.filter(r => r.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Wallet className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Monthly Credits</p>
                <p className="text-2xl font-bold">{totalMonthlyBudget}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Sponsored</p>
                <p className="text-2xl font-bold">
                  {relationships.filter(r => r.billing_arrangement === 'agency_sponsored').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="relationships" className="space-y-6">
        <TabsList>
          <TabsTrigger value="relationships" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Admin Relationships
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Billing Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relationships" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Admin Billing Relationships
              </CardTitle>
              <CardDescription>
                Manage billing arrangements with your admin clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No admin relationships found</p>
                  <p className="text-sm">Create billing relationships with your admin clients</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admin</TableHead>
                      <TableHead>Billing Arrangement</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Monthly Credits</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationships.map((relationship) => (
                      <TableRow key={relationship.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {relationship.admin_profile.full_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {relationship.admin_profile.company}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getArrangementBadge(relationship.billing_arrangement)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(relationship.status)}
                        </TableCell>
                        <TableCell>
                          {relationship.monthly_credit_allocation > 0 
                            ? `${relationship.monthly_credit_allocation} credits` 
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          {new Date(relationship.billing_start_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRelationship(relationship);
                                loadRelationshipHistory(relationship.id);
                                setShowHistoryDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {relationship.status === 'active' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRelationship(relationship);
                                    setShowTransferDialog(true);
                                  }}
                                >
                                  <Send className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRelationship(relationship);
                                    setShowTerminateDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Agency Billing Settings
              </CardTitle>
              <CardDescription>
                Configure your agency's billing preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings && (
                <>
                  <div className="space-y-4">
                    <h4 className="font-medium">Sponsorship Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable Admin Sponsorship</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow your agency to pay for admin services
                          </p>
                        </div>
                        <Switch
                          checked={settings.can_sponsor_admins}
                          onCheckedChange={(checked) =>
                            updateSettings({ can_sponsor_admins: checked })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="max-admins">Maximum Sponsored Admins</Label>
                          <Input
                            id="max-admins"
                            type="number"
                            value={settings.max_sponsored_admins}
                            onChange={(e) =>
                              setSettings(prev => prev ? 
                                { ...prev, max_sponsored_admins: parseInt(e.target.value) || 0 } : prev
                              )
                            }
                            onBlur={() =>
                              updateSettings({ max_sponsored_admins: settings.max_sponsored_admins })
                            }
                            min="1"
                            max="100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="default-allocation">Default Monthly Credits</Label>
                          <Input
                            id="default-allocation"
                            type="number"
                            value={settings.default_monthly_allocation}
                            onChange={(e) =>
                              setSettings(prev => prev ?
                                { ...prev, default_monthly_allocation: parseInt(e.target.value) || 0 } : prev
                              )
                            }
                            onBlur={() =>
                              updateSettings({ default_monthly_allocation: settings.default_monthly_allocation })
                            }
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Automation Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Auto-allocate Credits</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically allocate credits to sponsored admins monthly
                          </p>
                        </div>
                        <Switch
                          checked={settings.auto_allocate_credits}
                          onCheckedChange={(checked) =>
                            updateSettings({ auto_allocate_credits: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Auto-terminate on Budget Exceeded</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically terminate sponsorships if monthly budget is exceeded
                          </p>
                        </div>
                        <Switch
                          checked={settings.auto_terminate_on_budget_exceeded}
                          onCheckedChange={(checked) =>
                            updateSettings({ auto_terminate_on_budget_exceeded: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Budget Settings</h4>
                    <div className="space-y-2">
                      <Label htmlFor="monthly-budget">Monthly Admin Budget (USD)</Label>
                      <Input
                        id="monthly-budget"
                        type="number"
                        value={settings.monthly_admin_budget_cents ? (settings.monthly_admin_budget_cents / 100).toFixed(2) : ''}
                        onChange={(e) => {
                          const cents = Math.round(parseFloat(e.target.value || '0') * 100);
                          setSettings(prev => prev ? 
                            { ...prev, monthly_admin_budget_cents: cents } : prev
                          );
                        }}
                        onBlur={() =>
                          updateSettings({ monthly_admin_budget_cents: settings.monthly_admin_budget_cents })
                        }
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Relationship Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create Admin Billing Relationship
            </DialogTitle>
            <DialogDescription>
              Set up a billing arrangement with an admin client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-id">Admin User ID</Label>
              <Input
                id="admin-id"
                value={newRelationship.adminUserId}
                onChange={(e) =>
                  setNewRelationship(prev => ({ ...prev, adminUserId: e.target.value }))
                }
                placeholder="Enter admin's user ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arrangement">Billing Arrangement</Label>
              <Select
                value={newRelationship.billingArrangement}
                onValueChange={(value: 'agency_sponsored' | 'agency_allocated') =>
                  setNewRelationship(prev => ({ ...prev, billingArrangement: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency_sponsored">Agency Sponsored</SelectItem>
                  <SelectItem value="agency_allocated">Credit Allocation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits">Monthly Credits Allocation</Label>
              <Input
                id="credits"
                type="number"
                value={newRelationship.monthlyCreditsAllocation}
                onChange={(e) =>
                  setNewRelationship(prev => ({
                    ...prev,
                    monthlyCreditsAllocation: parseInt(e.target.value) || 0
                  }))
                }
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date (Optional)</Label>
              <Input
                id="end-date"
                type="date"
                value={newRelationship.billingEndDate || ''}
                onChange={(e) =>
                  setNewRelationship(prev => ({ ...prev, billingEndDate: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createRelationship}>
                Create Relationship
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Credits Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Transfer Credits
            </DialogTitle>
            <DialogDescription>
              Transfer credits to {selectedRelationship?.admin_profile.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credit-amount">Credits to Transfer</Label>
              <Input
                id="credit-amount"
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Enter number of credits"
                min="1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                Cancel
              </Button>
              <Button onClick={transferCredits}>
                Transfer Credits
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Billing History</DialogTitle>
            <DialogDescription>
              {selectedRelationship && (
                <>Billing history for {selectedRelationship.admin_profile.full_name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {billingHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No billing history found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingHistory.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {event.event_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {event.credits_transferred && (
                            <div className="text-sm">
                              Credits: {event.credits_transferred}
                            </div>
                          )}
                          {event.amount_cents && (
                            <div className="text-sm">
                              Amount: ${(event.amount_cents / 100).toFixed(2)} {event.currency}
                            </div>
                          )}
                          {event.new_arrangement && (
                            <div className="text-sm">
                              Arrangement: {getArrangementBadge(event.new_arrangement)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(event.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Terminate Relationship Dialog */}
      <Dialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Terminate Admin Relationship
            </DialogTitle>
            <DialogDescription>
              This will end your billing relationship with the admin. They will be switched to direct billing.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="termination-reason">Reason for termination (optional)</Label>
              <Textarea
                id="termination-reason"
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                placeholder="Explain why you're ending this relationship..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTerminateDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={terminateRelationship}>
                Terminate Relationship
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

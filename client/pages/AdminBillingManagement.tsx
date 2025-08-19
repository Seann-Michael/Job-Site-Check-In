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
  agency_profile: {
    full_name: string;
    agency_name: string;
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

interface BillingPreferences {
  admin_user_id: string;
  allow_agency_sponsorship: boolean;
  auto_accept_agency_invites: boolean;
  fallback_to_direct_billing: boolean;
  notify_billing_changes: boolean;
  notify_relationship_changes: boolean;
  notify_credit_allocations: boolean;
  billing_email?: string;
  billing_phone?: string;
}

export default function AdminBillingManagement() {
  const { user, token } = useAuth();
  const [relationships, setRelationships] = useState<BillingRelationship[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [allocationHistory, setAllocationHistory] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<BillingPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRelationship, setSelectedRelationship] = useState<BillingRelationship | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showAllocationHistoryDialog, setShowAllocationHistoryDialog] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');

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

      // Load preferences
      const preferencesResponse = await fetch('/api/billing/admin-agency/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (preferencesResponse.ok) {
        const preferencesData = await preferencesResponse.json();
        setPreferences(preferencesData.preferences);
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

  const loadAllocationHistory = async (relationshipId?: string) => {
    if (!token) return;

    try {
      let url = '/api/credit-allocation/history';
      if (relationshipId) {
        url += `?relationshipId=${relationshipId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAllocationHistory(data.allocations || []);
      } else {
        throw new Error('Failed to load allocation history');
      }
    } catch (error) {
      console.error('Error loading allocation history:', error);
      toast.error('Failed to load allocation history');
    }
  };

  const updatePreferences = async (newPreferences: Partial<BillingPreferences>) => {
    if (!token) return;

    try {
      const response = await fetch('/api/billing/admin-agency/update-preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPreferences),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
        toast.success('Preferences updated successfully');
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
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
          newStatus: 'admin_ejected',
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
          <h1 className="text-3xl font-bold">Billing Management</h1>
          <p className="text-muted-foreground">Manage your billing arrangements with agencies</p>
        </div>
      </div>

      <Tabs defaultValue="relationships" className="space-y-6">
        <TabsList>
          <TabsTrigger value="relationships" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Agency Relationships
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Billing Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relationships" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Agency Billing Relationships
              </CardTitle>
              <CardDescription>
                View and manage your billing relationships with agencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No agency relationships found</p>
                  <p className="text-sm">Agencies can invite you to join their billing plan</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agency</TableHead>
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
                              {relationship.agency_profile.agency_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {relationship.agency_profile.full_name}
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
                              title="Billing History"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRelationship(relationship);
                                loadAllocationHistory(relationship.id);
                                setShowAllocationHistoryDialog(true);
                              }}
                              title="Credit Allocations"
                            >
                              <Wallet className="h-4 w-4 text-green-500" />
                            </Button>
                            {relationship.status === 'active' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRelationship(relationship);
                                  setShowTerminateDialog(true);
                                }}
                                title="Terminate Relationship"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
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

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Billing Preferences
              </CardTitle>
              <CardDescription>
                Configure your billing and notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {preferences && (
                <>
                  <div className="space-y-4">
                    <h4 className="font-medium">Agency Sponsorship Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Allow Agency Sponsorship</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow agencies to pay for your service
                          </p>
                        </div>
                        <Switch
                          checked={preferences.allow_agency_sponsorship}
                          onCheckedChange={(checked) =>
                            updatePreferences({ allow_agency_sponsorship: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Auto-accept Agency Invites</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically accept agency billing invitations
                          </p>
                        </div>
                        <Switch
                          checked={preferences.auto_accept_agency_invites}
                          onCheckedChange={(checked) =>
                            updatePreferences({ auto_accept_agency_invites: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Fallback to Direct Billing</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically switch to direct billing if agency relationship ends
                          </p>
                        </div>
                        <Switch
                          checked={preferences.fallback_to_direct_billing}
                          onCheckedChange={(checked) =>
                            updatePreferences({ fallback_to_direct_billing: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Notification Settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Billing Changes</Label>
                        <Switch
                          checked={preferences.notify_billing_changes}
                          onCheckedChange={(checked) =>
                            updatePreferences({ notify_billing_changes: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Relationship Changes</Label>
                        <Switch
                          checked={preferences.notify_relationship_changes}
                          onCheckedChange={(checked) =>
                            updatePreferences({ notify_relationship_changes: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Credit Allocations</Label>
                        <Switch
                          checked={preferences.notify_credit_allocations}
                          onCheckedChange={(checked) =>
                            updatePreferences({ notify_credit_allocations: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Contact Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="billing-email">Billing Email</Label>
                        <Input
                          id="billing-email"
                          type="email"
                          value={preferences.billing_email || ''}
                          onChange={(e) =>
                            setPreferences(prev => prev ? 
                              { ...prev, billing_email: e.target.value } : prev
                            )
                          }
                          onBlur={() =>
                            updatePreferences({ billing_email: preferences.billing_email })
                          }
                          placeholder="billing@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing-phone">Billing Phone</Label>
                        <Input
                          id="billing-phone"
                          type="tel"
                          value={preferences.billing_phone || ''}
                          onChange={(e) =>
                            setPreferences(prev => prev ?
                              { ...prev, billing_phone: e.target.value } : prev
                            )
                          }
                          onBlur={() =>
                            updatePreferences({ billing_phone: preferences.billing_phone })
                          }
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Billing History</DialogTitle>
            <DialogDescription>
              {selectedRelationship && (
                <>Billing history for relationship with {selectedRelationship.agency_profile.agency_name}</>
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

      {/* Allocation History Dialog */}
      <Dialog open={showAllocationHistoryDialog} onOpenChange={setShowAllocationHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Credit Allocation History
            </DialogTitle>
            <DialogDescription>
              {selectedRelationship && (
                <>Credit allocations from {selectedRelationship.agency_profile.agency_name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {allocationHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No credit allocations found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocationHistory.map((allocation) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        <Badge variant={allocation.allocation_type === 'monthly_auto' ? 'default' : 'secondary'}>
                          {allocation.allocation_type === 'monthly_auto' ? 'Monthly Auto' :
                           allocation.allocation_type === 'manual' ? 'Manual' : 'Bonus'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {allocation.credits_amount} credits
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          allocation.status === 'processed' ? 'default' :
                          allocation.status === 'failed' ? 'destructive' :
                          allocation.status === 'cancelled' ? 'secondary' : 'outline'
                        }>
                          {allocation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={allocation.allocation_reason}>
                          {allocation.allocation_reason || 'N/A'}
                        </div>
                        {allocation.failure_reason && (
                          <div className="text-sm text-red-600">
                            {allocation.failure_reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          {new Date(allocation.created_at).toLocaleDateString()}
                        </div>
                        {allocation.processed_at && (
                          <div className="text-sm text-muted-foreground">
                            Processed: {new Date(allocation.processed_at).toLocaleDateString()}
                          </div>
                        )}
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
              Terminate Agency Relationship
            </DialogTitle>
            <DialogDescription>
              This will end your billing relationship with the agency and switch you to direct billing.
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

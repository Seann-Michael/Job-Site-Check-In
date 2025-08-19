import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Users, 
  Link, 
  Activity, 
  Clock,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  RotateCcw,
  Trash2,
  Mail,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Download,
  Plus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { 
  OnboardingSession,
  ClientAccess,
  ClientAccessStats,
  OAuthActivityLog,
  PLATFORM_DISPLAY_NAMES
} from '../../types/oauth';

interface ClientAccessDashboardProps {
  onCreateNew?: () => void;
}

interface ClientDetailModalProps {
  session: OnboardingSession;
  isOpen: boolean;
  onClose: () => void;
  onRevoke: (sessionId: string, platform?: string) => void;
  onRegenerateLink: (sessionId: string) => void;
}

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  session,
  isOpen,
  onClose,
  onRevoke,
  onRegenerateLink
}) => {
  const [clientAccess, setClientAccess] = useState<ClientAccess[]>([]);
  const [activityLog, setActivityLog] = useState<OAuthActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState('platforms');

  useEffect(() => {
    if (isOpen && session) {
      // Load client access data
      fetchClientAccess();
      fetchActivityLog();
    }
  }, [isOpen, session]);

  const fetchClientAccess = async () => {
    try {
      const response = await fetch(`/api/oauth/sessions/${session.id}/access`);
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text);
          setClientAccess(data.data || []);
        }
      } else {
        console.warn('Client access API not available:', response.status);
        setClientAccess([]);
      }
    } catch (error) {
      console.error('Error fetching client access:', error);
      setClientAccess([]);
    }
  };

  const fetchActivityLog = async () => {
    try {
      const response = await fetch(`/api/oauth/sessions/${session.id}/activity`);
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text);
          setActivityLog(data.data || []);
        }
      } else {
        console.warn('Activity log API not available:', response.status);
        setActivityLog([]);
      }
    } catch (error) {
      console.error('Error fetching activity log:', error);
      setActivityLog([]);
    }
  };

  const testConnection = async (platform: string) => {
    try {
      const response = await fetch(`/api/oauth/test/${platform}?sessionId=${session.id}`, {
        method: 'POST'
      });
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const result = JSON.parse(text);
          console.log('Connection test result:', result);
          // TODO: Show toast notification with result
        }
      } else {
        console.warn('Connection test API not available:', response.status);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
    }
  };

  const exportActivityLog = () => {
    const csv = [
      ['Date', 'Platform', 'Event', 'Details'],
      ...activityLog.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.platform || 'System',
        log.event_type,
        JSON.stringify(log.event_data)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.client_name}-activity-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div>
              <div className="text-xl">{session.client_name}</div>
              <div className="text-sm text-muted-foreground font-normal">
                {session.client_email} • {session.client_company}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Manage platform connections and view activity for this client
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="platforms" className="space-y-4">
            <div className="grid gap-4">
              {session.required_platforms.map(platformId => {
                const access = clientAccess.find(a => a.platform === platformId);
                const platformName = PLATFORM_DISPLAY_NAMES[platformId as keyof typeof PLATFORM_DISPLAY_NAMES] || platformId;
                
                return (
                  <Card key={platformId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <CardTitle className="text-base">{platformName}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={access?.status === 'connected' ? 'default' : 'secondary'}
                                className={access?.status === 'connected' ? 'bg-green-500' : ''}
                              >
                                {access?.status || 'not_connected'}
                              </Badge>
                              {access?.last_sync_at && (
                                <span className="text-xs text-muted-foreground">
                                  Last sync: {new Date(access.last_sync_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {access?.status === 'connected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => testConnection(platformId)}
                            >
                              Test Connection
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onRevoke(session.id, platformId)}
                          >
                            Revoke Access
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {access && (
                      <CardContent>
                        <div className="space-y-2">
                          {access.account_info.accountName && (
                            <div className="text-sm">
                              <span className="font-medium">Account:</span> {access.account_info.accountName}
                            </div>
                          )}
                          {access.account_info.email && (
                            <div className="text-sm">
                              <span className="font-medium">Email:</span> {access.account_info.email}
                            </div>
                          )}
                          {access.permissions.length > 0 && (
                            <div className="text-sm">
                              <span className="font-medium">Permissions:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {access.permissions.map(permission => (
                                  <Badge key={permission} variant="outline" className="text-xs">
                                    {permission}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {access.error_message && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {access.error_message}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Activity Timeline</h3>
              <Button variant="outline" size="sm" onClick={exportActivityLog}>
                <Download className="h-4 w-4 mr-2" />
                Export Log
              </Button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activityLog.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{log.event_type.replace('_', ' ')}</span>
                      {log.platform && (
                        <Badge variant="secondary" className="text-xs">
                          {PLATFORM_DISPLAY_NAMES[log.platform as keyof typeof PLATFORM_DISPLAY_NAMES] || log.platform}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    {Object.keys(log.event_data).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer">Event Details</summary>
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(log.event_data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Client Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={session.client_name} readOnly />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={session.client_email} readOnly />
                    </div>
                  </div>
                  <div>
                    <Label>Company</Label>
                    <Input value={session.client_company || 'Not provided'} readOnly />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Onboarding Link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input 
                      value={`${window.location.origin}/onboard/${session.onboarding_token}`}
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() => onRegenerateLink(session.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Expires: {new Date(session.expires_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={() => onRevoke(session.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Revoke All Access
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    This will remove all platform connections for this client and cannot be undone.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export const ClientAccessDashboard: React.FC<ClientAccessDashboardProps> = ({ onCreateNew }) => {
  const [sessions, setSessions] = useState<OnboardingSession[]>([]);
  const [stats, setStats] = useState<ClientAccessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<OnboardingSession | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [apiAvailable, setApiAvailable] = useState(true);

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.client_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (session.client_company?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    fetchData();
  }, [page]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch stats with proper error handling
      try {
        const statsResponse = await fetch('/api/oauth/stats');
        if (statsResponse.ok) {
          const statsText = await statsResponse.text();
          if (statsText) {
            const statsData = JSON.parse(statsText);
            setStats(statsData.data);
          }
        } else {
          console.warn('Stats API not available:', statsResponse.status);
          // Set default stats
          setStats({
            total_active_connections: 0,
            pending_onboarding_links: 0,
            connections_this_month: 0,
            average_onboarding_time: 0
          });
        }
      } catch (statsError) {
        console.warn('Error fetching stats, using defaults:', statsError);
        setStats({
          total_active_connections: 0,
          pending_onboarding_links: 0,
          connections_this_month: 0,
          average_onboarding_time: 0
        });
      }

      // Fetch sessions with proper error handling
      try {
        const sessionsResponse = await fetch(`/api/oauth/sessions?page=${page}&limit=25`);
        if (sessionsResponse.ok) {
          const sessionsText = await sessionsResponse.text();
          if (sessionsText) {
            const sessionsData = JSON.parse(sessionsText);
            setSessions(sessionsData.data || []);
            setTotalPages(sessionsData.pagination?.totalPages || 1);
          }
        } else {
          console.warn('Sessions API not available:', sessionsResponse.status);
          setSessions([]);
          setTotalPages(1);
        }
      } catch (sessionsError) {
        console.warn('Error fetching sessions, using defaults:', sessionsError);
        setSessions([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Set default values
      setStats({
        total_active_connections: 0,
        pending_onboarding_links: 0,
        connections_this_month: 0,
        average_onboarding_time: 0
      });
      setSessions([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const regenerateLink = async (sessionId: string) => {
    try {
      await fetch(`/api/oauth/sessions/${sessionId}/regenerate`, { method: 'POST' });
      fetchData(); // Refresh data
      // TODO: Show success toast
    } catch (error) {
      console.error('Error regenerating link:', error);
    }
  };

  const revokeAccess = async (sessionId: string, platform?: string) => {
    try {
      const url = platform 
        ? `/api/oauth/sessions/${sessionId}/revoke/${platform}`
        : `/api/oauth/sessions/${sessionId}/revoke`;
      
      await fetch(url, { method: 'POST' });
      fetchData(); // Refresh data
      // TODO: Show success toast
    } catch (error) {
      console.error('Error revoking access:', error);
    }
  };

  const sendReminder = async (sessionId: string) => {
    try {
      await fetch(`/api/oauth/sessions/${sessionId}/remind`, { method: 'POST' });
      // TODO: Show success toast
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      'in-progress': 'default',
      completed: 'default',
      expired: 'destructive'
    };
    
    const colors = {
      pending: '',
      'in-progress': 'bg-blue-500',
      completed: 'bg-green-500',
      expired: ''
    };

    return (
      <Badge 
        variant={variants[status as keyof typeof variants] || 'secondary'}
        className={colors[status as keyof typeof colors]}
      >
        {status.replace('-', ' ')}
      </Badge>
    );
  };

  const getPlatformBadges = (session: OnboardingSession) => {
    return session.connected_platforms.map(cp => (
      <Badge 
        key={cp.platform} 
        variant={cp.status === 'connected' ? 'default' : 'secondary'}
        className={`text-xs ${cp.status === 'connected' ? 'bg-green-500' : ''}`}
      >
        {PLATFORM_DISPLAY_NAMES[cp.platform as keyof typeof PLATFORM_DISPLAY_NAMES] || cp.platform}
      </Badge>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading client access data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_active_connections}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Links</CardTitle>
              <Link className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending_onboarding_links}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.connections_this_month}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Onboarding</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.average_onboarding_time}h</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle>Client Connections</CardTitle>
              <CardDescription>Manage client platform connections and onboarding links</CardDescription>
            </div>
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map(session => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{session.client_name}</div>
                        <div className="text-sm text-muted-foreground">{session.client_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{session.client_company || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getPlatformBadges(session)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedSession(session)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => regenerateLink(session.id)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Regenerate Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sendReminder(session.id)}>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Reminder
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => revokeAccess(session.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Revoke Access
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
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Detail Modal */}
      {selectedSession && (
        <ClientDetailModal
          session={selectedSession}
          isOpen={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          onRevoke={revokeAccess}
          onRegenerateLink={regenerateLink}
        />
      )}
    </div>
  );
};

export default ClientAccessDashboard;

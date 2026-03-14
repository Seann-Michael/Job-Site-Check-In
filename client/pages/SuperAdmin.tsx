import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { EnhancedBroadcastAlert } from "@/components/EnhancedBroadcastAlert";
import {
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Building2,
  Star,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export default function SuperAdmin() {
  const [timeFrame, setTimeFrame] = useState("30d");
  const [hideMetrics, setHideMetrics] = useState(() => {
    const saved = localStorage.getItem("super_admin_hide_metrics");
    return saved ? JSON.parse(saved) : true; // Default: metrics hidden
  });

  const toggleMetrics = () => {
    const newValue = !hideMetrics;
    setHideMetrics(newValue);
    localStorage.setItem("super_admin_hide_metrics", JSON.stringify(newValue));
  };

  // Mock analytics data based on time frame
  const analyticsData = {
    "1d": {
      activeUsers: 1247,
      dailyActiveUsers: 812,
      newSignups: 45,
      userRetention: 87.3,
      apiCalls: 45678,
      activeProjects: 234,
      reviewsGenerated: 123,
    },
    "7d": {
      activeUsers: 1289,
      dailyActiveUsers: 834,
      newSignups: 289,
      userRetention: 86.8,
      apiCalls: 298765,
      activeProjects: 267,
      reviewsGenerated: 856,
    },
    "30d": {
      activeUsers: 1456,
      dailyActiveUsers: 943,
      newSignups: 1247,
      userRetention: 87.3,
      apiCalls: 987654,
      activeProjects: 289,
      reviewsGenerated: 3456,
    },
    "60d": {
      activeUsers: 1623,
      dailyActiveUsers: 1056,
      newSignups: 2134,
      userRetention: 88.1,
      apiCalls: 1876543,
      activeProjects: 334,
      reviewsGenerated: 6789,
    },
    "90d": {
      activeUsers: 1789,
      dailyActiveUsers: 1167,
      newSignups: 3421,
      userRetention: 88.9,
      apiCalls: 2765432,
      activeProjects: 389,
      reviewsGenerated: 9876,
    },
    "180d": {
      activeUsers: 2156,
      dailyActiveUsers: 1402,
      newSignups: 6789,
      userRetention: 89.5,
      apiCalls: 5432109,
      activeProjects: 456,
      reviewsGenerated: 18765,
    },
    "365d": {
      activeUsers: 2847,
      dailyActiveUsers: 1851,
      newSignups: 12456,
      userRetention: 90.2,
      apiCalls: 9876543,
      activeProjects: 567,
      reviewsGenerated: 34567,
    },
  };

  const currentData = analyticsData[timeFrame as keyof typeof analyticsData];

  // User growth trend data for charts
  const userGrowthData = [
    { period: "6 months ago", users: 1234, growth: "+15%" },
    { period: "5 months ago", users: 1456, growth: "+18%" },
    { period: "4 months ago", users: 1623, growth: "+11%" },
    { period: "3 months ago", users: 1789, growth: "+10%" },
    { period: "2 months ago", users: 1987, growth: "+11%" },
    { period: "Last month", users: 2156, growth: "+8%" },
    { period: "This month", users: 2847, growth: "+32%" },
  ];

  const usageMetrics = [
    {
      label: "API Calls Today",
      value: "45,678",
      change: "+15%",
      trend: "up",
      icon: Activity,
    },
    {
      label: "Active Projects",
      value: currentData.activeProjects.toString(),
      change: "+8%",
      trend: "up",
      icon: Building2,
    },
    {
      label: "Reviews Generated",
      value: currentData.reviewsGenerated.toLocaleString(),
      change: "+12%",
      trend: "up",
      icon: Star,
    },
    {
      label: "User Sessions",
      value: "12,456",
      change: "+23%",
      trend: "up",
      icon: Users,
    },
  ];

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Broadcast Messages */}
        <EnhancedBroadcastAlert />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Software performance and user analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={toggleMetrics} className="gap-2">
              {hideMetrics ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {hideMetrics ? "Show Metrics" : "Hide Metrics"}
            </Button>
            <Select value={timeFrame} onValueChange={setTimeFrame}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time frame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="60d">Last 60 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="180d">Last 180 Days</SelectItem>
                <SelectItem value="365d">Last 365 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Key Performance Metrics - Always visible, values conditionally hidden */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hideMetrics ? "***" : currentData.activeUsers.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <ArrowUp className="h-3 w-3 mr-1 text-green-500" />
                {hideMetrics ? "Hidden" : "+12% from last period"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Daily Active Users
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hideMetrics
                  ? "***"
                  : currentData.dailyActiveUsers.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <ArrowUp className="h-3 w-3 mr-1 text-green-500" />
                {hideMetrics ? "Hidden" : "+8% from last period"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Signups</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hideMetrics ? "***" : currentData.newSignups.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <ArrowUp className="h-3 w-3 mr-1 text-green-500" />
                {hideMetrics ? "Hidden" : "+23% from last period"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                User Retention
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hideMetrics ? "***%" : `${currentData.userRetention}%`}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <ArrowUp className="h-3 w-3 mr-1 text-green-500" />
                {hideMetrics ? "Hidden" : "+5.2% from last period"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* User Growth Chart */}
          <Card>
            <CardHeader>
              <CardTitle>User Growth Trends</CardTitle>
              <CardDescription>
                User acquisition and retention over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userGrowthData.map((data, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-20 text-sm font-medium truncate">
                        {data.period}
                      </div>
                      <div className="flex-1 bg-muted rounded-full h-2 relative min-w-[100px]">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.max((data.users / 3000) * 100, 10)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-12 text-right">
                        {data.users.toLocaleString()}
                      </span>
                      <span className="text-xs text-green-600 w-10">
                        {data.growth}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Platform Usage Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Usage</CardTitle>
              <CardDescription>
                Real-time system activity and engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usageMetrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{metric.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {metric.value} total
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {metric.trend === "up" ? (
                          <ArrowUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-red-500" />
                        )}
                        <span
                          className={`text-sm ${
                            metric.trend === "up"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {metric.change}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage all users and their accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link to="/super-admin/users">
                  <Button variant="outline" className="w-full gap-2">
                    <Eye className="h-4 w-4" />
                    View All Users
                  </Button>
                </Link>
                <Link to="/super-admin/users/add">
                  <Button className="w-full gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add New User
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Management
              </CardTitle>
              <CardDescription>
                Manage all businesses and their accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link to="/super-admin/businesses">
                  <Button variant="outline" className="w-full gap-2">
                    <Eye className="h-4 w-4" />
                    View All Businesses
                  </Button>
                </Link>
                <Link to="/super-admin/businesses/add">
                  <Button className="w-full gap-2">
                    <Building2 className="h-4 w-4" />
                    Add New Business
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Agency Management
              </CardTitle>
              <CardDescription>
                Manage marketing agencies and partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link to="/super-admin/agencies">
                  <Button variant="outline" className="w-full gap-2">
                    <Eye className="h-4 w-4" />
                    View All Agencies
                  </Button>
                </Link>
                <Link to="/super-admin/agencies/add">
                  <Button className="w-full gap-2">
                    <Building2 className="h-4 w-4" />
                    Add New Agency
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics & Reports
              </CardTitle>
              <CardDescription>
                Financial metrics and system insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link to="/super-admin/settings">
                  <Button variant="outline" className="w-full gap-2">
                    <Users className="h-4 w-4" />
                    System Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}

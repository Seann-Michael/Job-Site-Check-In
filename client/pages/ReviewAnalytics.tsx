// @ts-nocheck
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  ArrowLeft,
  Calendar,
  Award,
  BarChart3,
  RefreshCw,
  Plug,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { supabase } from "@/lib/dataService";

interface ReviewDataPoint {
  date: string;
  label: string;
  reviewCount: number;
  rating: number;
}

interface ReviewSnapshot {
  connectedAt: string;
  connectedCount: number;
  connectedRating: number;
  currentCount: number;
  currentRating: number;
}

// Generate realistic mock data for a business that connected ~12 months ago
function generateMockData(months: number): ReviewDataPoint[] {
  const points: ReviewDataPoint[] = [];
  const now = new Date();
  const startCount = 42;
  const startRating = 4.1;

  for (let i = months; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);

    const monthProgress = (months - i) / months;
    // Realistic gradual growth with some variance
    const reviewGrowth = Math.round(
      startCount + monthProgress * 85 + Math.sin(i * 0.8) * 3
    );
    const ratingDrift =
      startRating + monthProgress * 0.6 + Math.sin(i * 0.5) * 0.05;

    points.push({
      date: date.toISOString().slice(0, 7),
      label: date.toLocaleString("default", { month: "short", year: "2-digit" }),
      reviewCount: Math.max(startCount, reviewGrowth),
      rating: Math.min(5, Math.max(3.5, parseFloat(ratingDrift.toFixed(1)))),
    });
  }
  return points;
}

const MOCK_SNAPSHOT: ReviewSnapshot = {
  connectedAt: "2024-03-01",
  connectedCount: 42,
  connectedRating: 4.1,
  currentCount: 127,
  currentRating: 4.7,
};

const CustomTooltipReviews = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomTooltipRating = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">⭐ {entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= Math.round(rating)
              ? "text-yellow-400 fill-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

export default function ReviewAnalytics() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("12");
  const [chartData, setChartData] = useState<ReviewDataPoint[]>([]);
  const [snapshot, setSnapshot] = useState<ReviewSnapshot>(MOCK_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"live" | "demo">("demo");

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Attempt to fetch real analytics data from Supabase
      const months = parseInt(timeRange, 10);
      const since = new Date();
      since.setMonth(since.getMonth() - months);

      const { data: analyticsRows, error } = await supabase
        .from("analytics")
        .select("*")
        .in("metric_type", ["review_count", "review_rating"])
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: true });

      if (!error && analyticsRows && analyticsRows.length > 0) {
        // Group by date and build chart data
        const grouped: Record<string, { count?: number; rating?: number }> = {};
        for (const row of analyticsRows) {
          const key = row.date?.slice(0, 7) ?? "";
          if (!grouped[key]) grouped[key] = {};
          if (row.metric_type === "review_count") {
            grouped[key].count = Number(row.value);
          } else if (row.metric_type === "review_rating") {
            grouped[key].rating = Number(row.value);
          }
        }

        const points: ReviewDataPoint[] = Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, vals]) => {
            const d = new Date(key + "-01");
            return {
              date: key,
              label: d.toLocaleString("default", {
                month: "short",
                year: "2-digit",
              }),
              reviewCount: vals.count ?? 0,
              rating: vals.rating ?? 0,
            };
          });

        setChartData(points);
        setDataSource("live");

        if (points.length > 0) {
          const first = points[0];
          const last = points[points.length - 1];
          setSnapshot({
            connectedAt: first.date,
            connectedCount: first.reviewCount,
            connectedRating: first.rating,
            currentCount: last.reviewCount,
            currentRating: last.rating,
          });
        }
      } else {
        // Fall back to realistic demo data
        setChartData(generateMockData(parseInt(timeRange, 10)));
        setSnapshot(MOCK_SNAPSHOT);
        setDataSource("demo");
      }
    } catch {
      setChartData(generateMockData(parseInt(timeRange, 10)));
      setSnapshot(MOCK_SNAPSHOT);
      setDataSource("demo");
    } finally {
      setIsLoading(false);
    }
  };

  const reviewGrowth = snapshot.currentCount - snapshot.connectedCount;
  const reviewGrowthPct =
    snapshot.connectedCount > 0
      ? ((reviewGrowth / snapshot.connectedCount) * 100).toFixed(1)
      : "0";
  const ratingChange = (
    snapshot.currentRating - snapshot.connectedRating
  ).toFixed(1);
  const ratingImproved = snapshot.currentRating >= snapshot.connectedRating;

  const connectedLabel = snapshot.connectedAt
    ? new Date(snapshot.connectedAt).toLocaleString("default", {
        month: "long",
        year: "numeric",
      })
    : "Connection date";

  // Find the index of the "connected" month in chart data
  const connectedMonthKey = snapshot.connectedAt?.slice(0, 7);
  const connectedDataPoint = chartData.find((d) => d.date === connectedMonthKey);

  return (
    <AppLayout>
      <div className="max-w-full px-4 py-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/reviews")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-blue-600 shrink-0" />
                Review Analytics
              </h1>
              <p className="text-muted-foreground text-sm">
                Google review growth and rating trends
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {dataSource === "demo" && (
              <Badge variant="secondary" className="gap-1 text-xs shrink-0">
                <Plug className="h-3 w-3" />
                Demo Data
              </Badge>
            )}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full sm:w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="24">Last 24 months</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={loadData}
              disabled={isLoading}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* When Connected */}
          <Card className="border-dashed border-gray-300">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Reviews at Connection
              </p>
              <p className="text-2xl font-bold text-gray-500">
                {snapshot.connectedCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {connectedLabel}
              </p>
              <StarDisplay rating={snapshot.connectedRating} />
              <p className="text-xs text-muted-foreground mt-0.5">
                {snapshot.connectedRating} avg rating
              </p>
            </CardContent>
          </Card>

          {/* Current Total */}
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Current Google Reviews
              </p>
              <p className="text-2xl font-bold text-blue-700">
                {snapshot.currentCount}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs text-green-600 font-medium">
                  +{reviewGrowth} since joining
                </span>
              </div>
              <StarDisplay rating={snapshot.currentRating} />
              <p className="text-xs text-muted-foreground mt-0.5">
                {snapshot.currentRating} avg rating
              </p>
            </CardContent>
          </Card>

          {/* Review Growth */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Review Growth
              </p>
              <p className="text-2xl font-bold text-green-600">
                +{reviewGrowthPct}%
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs text-green-600">
                  {reviewGrowth} new reviews
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Since connecting to platform
              </p>
            </CardContent>
          </Card>

          {/* Rating Change */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Rating Change
              </p>
              <p
                className={`text-2xl font-bold ${
                  ratingImproved ? "text-green-600" : "text-red-500"
                }`}
              >
                {parseFloat(ratingChange) >= 0 ? "+" : ""}
                {ratingChange}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {ratingImproved ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-xs ${
                    ratingImproved ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {ratingImproved ? "Improved" : "Declined"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {snapshot.connectedRating} → {snapshot.currentRating} stars
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Review Count Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Google Review Growth
            </CardTitle>
            <CardDescription>
              Total review count over time — dashed line marks when account was
              connected
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="reviewGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltipReviews />} />
                  {connectedDataPoint && (
                    <ReferenceLine
                      x={connectedDataPoint.label}
                      stroke="#9ca3af"
                      strokeDasharray="4 4"
                      label={{
                        value: "Connected",
                        position: "top",
                        fontSize: 11,
                        fill: "#6b7280",
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="reviewCount"
                    name="Total Reviews"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#reviewGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#3b82f6" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Before/After summary */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <div className="w-2 h-10 bg-gray-200 rounded-full" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Before platform
                  </p>
                  <p className="text-lg font-bold text-gray-600">
                    {snapshot.connectedCount} reviews
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-10 bg-blue-500 rounded-full" />
                <div>
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className="text-lg font-bold text-blue-700">
                    {snapshot.currentCount} reviews
                  </p>
                  <p className="text-xs text-green-600">
                    +{reviewGrowth} gained ({reviewGrowthPct}% growth)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rating Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Average Google Rating Over Time
            </CardTitle>
            <CardDescription>
              How your star rating has changed since connecting to the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[3, 5]}
                    tickCount={5}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(v) => `${v}★`}
                  />
                  <Tooltip content={<CustomTooltipRating />} />
                  {connectedDataPoint && (
                    <ReferenceLine
                      x={connectedDataPoint.label}
                      stroke="#9ca3af"
                      strokeDasharray="4 4"
                      label={{
                        value: "Connected",
                        position: "top",
                        fontSize: 11,
                        fill: "#6b7280",
                      }}
                    />
                  )}
                  <ReferenceLine
                    y={snapshot.connectedRating}
                    stroke="#d1d5db"
                    strokeDasharray="3 3"
                    label={{
                      value: `Start: ${snapshot.connectedRating}★`,
                      position: "right",
                      fontSize: 10,
                      fill: "#9ca3af",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    name="Avg Rating"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: "#f59e0b" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* Rating comparison */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-gray-300 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Rating at connection
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-lg font-bold text-gray-600">
                      {snapshot.connectedRating}
                    </p>
                    <StarDisplay rating={snapshot.connectedRating} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-yellow-400 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Current rating
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-lg font-bold text-yellow-600">
                      {snapshot.currentRating}
                    </p>
                    <StarDisplay rating={snapshot.currentRating} />
                  </div>
                  <p
                    className={`text-xs ${
                      ratingImproved ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {parseFloat(ratingChange) >= 0 ? "+" : ""}
                    {ratingChange} since joining
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Calendar,
  Award,
  BarChart3,
  RefreshCw,
  Plug,
} from "lucide-react";
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
} from "recharts";
import { supabase } from "@/lib/dataService";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Mock data ────────────────────────────────────────────────────────────────

function generateMockData(months: number): ReviewDataPoint[] {
  const points: ReviewDataPoint[] = [];
  const now = new Date();
  const startCount = 42;
  const startRating = 4.1;
  for (let i = months; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const monthProgress = (months - i) / months;
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

// ─── Chart tooltips ───────────────────────────────────────────────────────────

const CustomTooltipReviews = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((e: any) => (
        <p key={e.dataKey} style={{ color: e.color }}>
          {e.name}: <span className="font-bold">{e.value}</span>
        </p>
      ))}
    </div>
  );
};

const CustomTooltipRating = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((e: any) => (
        <p key={e.dataKey} style={{ color: e.color }}>
          {e.name}: <span className="font-bold">⭐ {e.value}</span>
        </p>
      ))}
    </div>
  );
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${
            s <= Math.round(rating)
              ? "text-yellow-400 fill-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewAnalyticsSection() {
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
      const months = parseInt(timeRange, 10);
      const since = new Date();
      since.setMonth(since.getMonth() - months);

      const { data: rows, error } = await supabase
        .from("analytics")
        .select("*")
        .in("metric_type", ["review_count", "review_rating"])
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: true });

      if (!error && rows && rows.length > 0) {
        const grouped: Record<string, { count?: number; rating?: number }> = {};
        for (const row of rows) {
          const key = row.date?.slice(0, 7) ?? "";
          if (!grouped[key]) grouped[key] = {};
          if (row.metric_type === "review_count") grouped[key].count = Number(row.value);
          else if (row.metric_type === "review_rating") grouped[key].rating = Number(row.value);
        }
        const points: ReviewDataPoint[] = Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, vals]) => {
            const d = new Date(key + "-01");
            return {
              date: key,
              label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
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
  const ratingChange = (snapshot.currentRating - snapshot.connectedRating).toFixed(1);
  const ratingImproved = snapshot.currentRating >= snapshot.connectedRating;
  const connectedLabel = snapshot.connectedAt
    ? new Date(snapshot.connectedAt).toLocaleString("default", { month: "long", year: "numeric" })
    : "Connection date";
  const connectedMonthKey = snapshot.connectedAt?.slice(0, 7);
  const connectedDataPoint = chartData.find((d) => d.date === connectedMonthKey);

  return (
    <div className="space-y-6">
      {/* Section header with time range + refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-foreground">Review Analytics</h2>
          {dataSource === "demo" && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Plug className="h-3 w-3" />
              Demo Data
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="24">Last 24 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-dashed border-gray-300">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Reviews at Connection</p>
            <p className="text-2xl font-bold text-gray-500">{snapshot.connectedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">{connectedLabel}</p>
            <StarDisplay rating={snapshot.connectedRating} />
            <p className="text-xs text-muted-foreground mt-0.5">{snapshot.connectedRating} avg</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Current Google Reviews</p>
            <p className="text-2xl font-bold text-blue-700">{snapshot.currentCount}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600 font-medium">+{reviewGrowth} since joining</span>
            </div>
            <StarDisplay rating={snapshot.currentRating} />
            <p className="text-xs text-muted-foreground mt-0.5">{snapshot.currentRating} avg</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Review Growth</p>
            <p className="text-2xl font-bold text-green-600">+{reviewGrowthPct}%</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">{reviewGrowth} new reviews</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Since connecting to platform</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Rating Change</p>
            <p className={`text-2xl font-bold ${ratingImproved ? "text-green-600" : "text-red-500"}`}>
              {parseFloat(ratingChange) >= 0 ? "+" : ""}{ratingChange}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {ratingImproved
                ? <TrendingUp className="h-3 w-3 text-green-500" />
                : <TrendingDown className="h-3 w-3 text-red-500" />}
              <span className={`text-xs ${ratingImproved ? "text-green-600" : "text-red-500"}`}>
                {ratingImproved ? "Improved" : "Declined"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {snapshot.connectedRating} → {snapshot.currentRating} stars
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Full-width tabbed chart card */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Tabs defaultValue="reviews" className="w-full">
              <TabsList className="mb-0">
                <TabsTrigger value="reviews" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Google Review Growth
                </TabsTrigger>
                <TabsTrigger value="rating" className="gap-1.5">
                  <Star className="h-3.5 w-3.5" />
                  Average Rating Over Time
                </TabsTrigger>
              </TabsList>

              {/* Review Growth */}
              <TabsContent value="reviews" className="mt-4">
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="reviewGradSection" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip content={<CustomTooltipReviews />} />
                        {connectedDataPoint && (
                          <ReferenceLine
                            x={connectedDataPoint.label}
                            stroke="#9ca3af"
                            strokeDasharray="4 4"
                            label={{ value: "Connected", position: "top", fontSize: 11, fill: "#6b7280" }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="reviewCount"
                          name="Total Reviews"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          fill="url(#reviewGradSection)"
                          dot={false}
                          activeDot={{ r: 5, fill: "#3b82f6" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-8 bg-gray-200 rounded-full shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Before platform</p>
                          <p className="font-bold text-gray-600">{snapshot.connectedCount} reviews</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-8 bg-blue-500 rounded-full shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Today</p>
                          <p className="font-bold text-blue-700">{snapshot.currentCount} reviews</p>
                          <p className="text-xs text-green-600">+{reviewGrowth} gained ({reviewGrowthPct}%)</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Average Rating */}
              <TabsContent value="rating" className="mt-4">
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
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
                            label={{ value: "Connected", position: "top", fontSize: 11, fill: "#6b7280" }}
                          />
                        )}
                        <ReferenceLine
                          y={snapshot.connectedRating}
                          stroke="#d1d5db"
                          strokeDasharray="3 3"
                          label={{ value: `Start: ${snapshot.connectedRating}★`, position: "right", fontSize: 10, fill: "#9ca3af" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="rating"
                          name="Avg Rating"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "#f59e0b" }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t text-sm">
                      <div className="flex items-center gap-3">
                        <Award className="h-8 w-8 text-gray-300 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Rating at connection</p>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-gray-600">{snapshot.connectedRating}</p>
                            <StarDisplay rating={snapshot.connectedRating} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Award className="h-8 w-8 text-yellow-400 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Current rating</p>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-yellow-600">{snapshot.currentRating}</p>
                            <StarDisplay rating={snapshot.currentRating} />
                          </div>
                          <p className={`text-xs ${ratingImproved ? "text-green-600" : "text-red-500"}`}>
                            {parseFloat(ratingChange) >= 0 ? "+" : ""}{ratingChange} since joining
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pt-0" />
      </Card>
    </div>
  );
}

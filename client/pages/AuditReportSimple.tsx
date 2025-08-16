import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import {
  ArrowLeft,
  Download,
  GitCompare,
  MapPin,
  Star,
  Phone,
  Globe,
  Clock,
  Users,
  Crown,
  Award,
  Shield,
  X,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

export default function AuditReportSimple() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);

  const mockData = {
    businessName: "Smith Construction LLC",
    scanDate: "2024-12-14T10:30:00Z",
    location: "Springfield, IL",
    averageRank: 3.4,
    waypoints: [
      { id: "wp_001", rank: 1, lat: 39.7917, lng: -89.6601 },
      { id: "wp_002", rank: 3, lat: 39.7717, lng: -89.6401 },
      { id: "wp_003", rank: 2, lat: 39.7617, lng: -89.6701 },
      { id: "wp_004", rank: 5, lat: 39.7817, lng: -89.6301 },
      { id: "wp_005", rank: 7, lat: 39.7517, lng: -89.6601 },
    ],
  };

  const getRankColor = (rank: number) => {
    if (rank <= 3) return "text-green-600 bg-green-100";
    if (rank <= 10) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4" />;
    if (rank <= 3) return <Award className="h-4 w-4" />;
    if (rank <= 10) return <Shield className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/audits/scan-history")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Scan History
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {mockData.businessName}
                </h1>
                <p className="text-sm text-gray-600">
                  Audit Report &#8226;{" "}
                  {new Date(mockData.scanDate).toLocaleDateString()} &#8226;{" "}
                  {mockData.location}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <GitCompare className="h-4 w-4" />
                Compare Scans
              </Button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100vh-140px)]">
          {/* Left Panel - Controls & Summary */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Audit Summary
            </h3>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Waypoints</span>
                <Badge variant="outline">{mockData.waypoints.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Average Rank</span>
                <Badge className={getRankColor(mockData.averageRank)}>
                  #{mockData.averageRank.toFixed(1)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Top 3 Positions</span>
                <Badge variant="secondary">
                  {mockData.waypoints.filter((wp) => wp.rank <= 3).length}
                </Badge>
              </div>
            </div>

            {/* Waypoint List */}
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Waypoints
            </h3>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {mockData.waypoints.map((waypoint, index) => (
                <Card
                  key={waypoint.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedWaypoint === waypoint.id
                      ? "ring-2 ring-blue-500 bg-blue-50"
                      : ""
                  }`}
                  onClick={() => setSelectedWaypoint(waypoint.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Waypoint {index + 1}
                          </p>
                          <p className="text-xs text-gray-500">
                            {waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRankIcon(waypoint.rank)}
                        <Badge className={getRankColor(waypoint.rank)}>
                          #{waypoint.rank}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Center Panel - Map Placeholder */}
          <div className="flex-1 relative bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Google Maps Integration
              </h3>
              <p className="text-gray-500 max-w-md">
                Interactive Google Maps with waypoint markers showing ranking
                positions will appear here.
                <br />
                <br />
                Click on waypoints in the left panel to see details in the right
                panel.
              </p>
            </div>
          </div>

          {/* Right Panel - Waypoint Details */}
          {selectedWaypoint && (
            <div className="w-96 bg-white border-l border-gray-200 shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Waypoint Details
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedWaypoint(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Business Profile Card */}
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Smith Construction LLC
                    </CardTitle>
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="h-3 w-3" />
                      Verified
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-900">
                      4.8 (247 reviews)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      (217) 555-0123
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      smithconstruction.com
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      123 Main St, Springfield, IL
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      Mon-Fri 8AM-6PM
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Current Rank */}
              <div className="text-center py-4 mb-6 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {getRankIcon(
                    mockData.waypoints.find((wp) => wp.id === selectedWaypoint)
                      ?.rank || 1,
                  )}
                  <span className="text-2xl font-bold text-gray-900">
                    #
                    {
                      mockData.waypoints.find(
                        (wp) => wp.id === selectedWaypoint,
                      )?.rank
                    }
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Current Ranking for "general contractor"
                </p>
              </div>

              {/* Competitors */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Nearby Competitors
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      name: "Elite Builders",
                      rank: 1,
                      rating: 4.6,
                      reviews: 189,
                    },
                    {
                      name: "Premier Home Builders",
                      rank: 2,
                      rating: 4.5,
                      reviews: 203,
                    },
                    {
                      name: "Springfield Construction",
                      rank: 4,
                      rating: 4.4,
                      reviews: 156,
                    },
                  ].map((competitor) => (
                    <Card
                      key={competitor.name}
                      className="border-l-4 border-l-gray-300"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            {competitor.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {getRankIcon(competitor.rank)}
                            <Badge
                              className={getRankColor(competitor.rank)}
                              variant="outline"
                            >
                              #{competitor.rank}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            <span>{competitor.rating}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{competitor.reviews} reviews</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

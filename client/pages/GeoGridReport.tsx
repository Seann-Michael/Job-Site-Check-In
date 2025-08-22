import React, { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GoogleMapComponent } from "@/components/GoogleMaps/GoogleMapComponentNew";
import {
  MapPin,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Building2,
  Star,
  Users,
  Award,
  BarChart3,
  Download,
  Share2,
  Printer,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface GeoScanResult {
  id: string;
  business_name: string;
  keyword: string;
  scan_date: string;
  scan_time: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  waypoints: WaypointResult[];
  competitors: Competitor[];
  scan_config: {
    pattern: "circle" | "grid";
    depth: number;
    device: string;
    os: string;
  };
  average_ranking: number;
  total_waypoints: number;
  rankings_found: number;
}

interface WaypointResult {
  id: string;
  position: { lat: number; lng: number };
  label: string;
  ranking: number | null;
  competitor_id?: string;
  isCenter?: boolean;
}

interface Competitor {
  id: string;
  name: string;
  address: string;
  website?: string;
  phone?: string;
  total_rankings: number;
  average_position: number;
  waypoint_rankings: Record<string, number>;
}

// Mock data for demonstration
const mockScanResult: GeoScanResult = {
  id: "scan_2024_001",
  business_name: "Joe's Pizza & More",
  keyword: "pizza restaurant",
  scan_date: "2024-01-15",
  scan_time: "14:30:00",
  location: {
    lat: 38.2493,
    lng: -122.0397,
    address: "2275 Lejeune Cir, Fairfield, CA 94533",
  },
  waypoints: [
    { id: "center", position: { lat: 38.2493, lng: -122.0397 }, label: "C", ranking: 2, isCenter: true },
    { id: "1", position: { lat: 38.2543, lng: -122.0347 }, label: "1", ranking: 1 },
    { id: "2", position: { lat: 38.2543, lng: -122.0447 }, label: "2", ranking: 3 },
    { id: "3", position: { lat: 38.2443, lng: -122.0347 }, label: "3", ranking: 15 },
    { id: "4", position: { lat: 38.2443, lng: -122.0447 }, label: "4", ranking: 8 },
    { id: "5", position: { lat: 38.2493, lng: -122.0297 }, label: "5", ranking: null },
    { id: "6", position: { lat: 38.2493, lng: -122.0497 }, label: "6", ranking: 12 },
    { id: "7", position: { lat: 38.2593, lng: -122.0397 }, label: "7", ranking: 5 },
    { id: "8", position: { lat: 38.2393, lng: -122.0397 }, label: "8", ranking: 18 },
  ],
  competitors: [
    {
      id: "comp_1",
      name: "Mario's Italian Kitchen",
      address: "123 Main St, Fairfield, CA",
      website: "mariositalian.com",
      phone: "(707) 555-0123",
      total_rankings: 6,
      average_position: 7.2,
      waypoint_rankings: {
        "center": 4,
        "1": 5,
        "2": 8,
        "3": 3,
        "4": 12,
        "6": 9,
      },
    },
    {
      id: "comp_2", 
      name: "Fairfield Pizza House",
      address: "456 Oak Ave, Fairfield, CA",
      phone: "(707) 555-0456",
      total_rankings: 5,
      average_position: 11.4,
      waypoint_rankings: {
        "center": 8,
        "2": 15,
        "4": 10,
        "6": 14,
        "7": 10,
      },
    },
    {
      id: "comp_3",
      name: "Tony's Pizzeria",
      address: "789 Pine St, Fairfield, CA",
      total_rankings: 4,
      average_position: 16.5,
      waypoint_rankings: {
        "1": 18,
        "3": 20,
        "7": 15,
        "8": 13,
      },
    },
  ],
  scan_config: {
    pattern: "circle",
    depth: 20,
    device: "desktop",
    os: "windows",
  },
  average_ranking: 6.7,
  total_waypoints: 9,
  rankings_found: 8,
};

export default function GeoGridReport() {
  const { reportId } = useParams();
  const [searchParams] = useSearchParams();
  const [scanResult, setScanResult] = useState<GeoScanResult | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Load scan result (mock data for now)
  useEffect(() => {
    const loadScanResult = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setScanResult(mockScanResult);
      } catch (error) {
        toast.error("Failed to load scan result");
      } finally {
        setLoading(false);
      }
    };

    loadScanResult();
  }, [reportId]);

  // Get ranking color based on position
  const getRankingColor = (ranking: number | null): string => {
    if (ranking === null) return "#6B7280"; // Gray for unranked
    if (ranking >= 1 && ranking <= 3) return "#10B981"; // Green (1-3)
    if (ranking >= 4 && ranking <= 9) return "#F59E0B"; // Yellow (4-9)
    if (ranking >= 10 && ranking <= 15) return "#FB923C"; // Orange (10-15)
    return "#EF4444"; // Red (16-20+)
  };

  // Get waypoints with competitor data if selected
  const displayWaypoints = useMemo(() => {
    if (!scanResult) return [];

    return scanResult.waypoints.map(waypoint => {
      let ranking = waypoint.ranking;

      // If competitor is selected, use their ranking for this waypoint
      if (selectedCompetitor) {
        const competitor = scanResult.competitors.find(c => c.id === selectedCompetitor);
        if (competitor && competitor.waypoint_rankings[waypoint.id] !== undefined) {
          ranking = competitor.waypoint_rankings[waypoint.id];
        } else {
          ranking = null; // Competitor not found at this waypoint
        }
      }

      return {
        ...waypoint,
        coordinates: waypoint.position, // Transform 'position' to 'coordinates' for GoogleMapComponent
        ranking,
        enabled: true, // All waypoints are always enabled in report view
      };
    });
  }, [scanResult, selectedCompetitor]);

  // Handle waypoint click to show competitors
  const handleWaypointClick = (waypointId: string) => {
    setSelectedWaypoint(waypointId);
    setShowCompetitorModal(true);
  };

  // Handle settings click
  const handleSettingsClick = () => {
    setShowSettingsModal(true);
  };

  // Calculate analytics based on current display (business or competitor)
  const analytics = useMemo(() => {
    const waypoints = displayWaypoints.filter(w => w.ranking !== null);
    const totalWaypoints = displayWaypoints.length;
    const rankedWaypoints = waypoints.length;
    
    if (rankedWaypoints === 0) {
      return {
        total: totalWaypoints,
        ranked: 0,
        average: 0,
        green: 0,
        yellow: 0,
        orange: 0,
        red: 0,
        unranked: totalWaypoints,
      };
    }

    const green = waypoints.filter(w => w.ranking! >= 1 && w.ranking! <= 3).length;
    const yellow = waypoints.filter(w => w.ranking! >= 4 && w.ranking! <= 9).length;
    const orange = waypoints.filter(w => w.ranking! >= 10 && w.ranking! <= 15).length;
    const red = waypoints.filter(w => w.ranking! >= 16).length;
    const unranked = totalWaypoints - rankedWaypoints;
    
    const average = waypoints.reduce((sum, w) => sum + w.ranking!, 0) / rankedWaypoints;

    return {
      total: totalWaypoints,
      ranked: rankedWaypoints,
      average: Math.round(average * 10) / 10,
      green,
      yellow,
      orange,
      red,
      unranked,
    };
  }, [displayWaypoints]);

  // Generate breadcrumbs
  const breadcrumbs = [
    { label: "Audits", href: "/admin/audits" },
    { label: "Scan History", href: "/admin/audits/scan-history" },
    { label: `Report ${reportId}` },
  ];

  if (loading) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading scan results...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!scanResult) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-600">Failed to load scan results</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header with branding overlay */}
        <div className="relative mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
            {/* Local SEO Ranker Branding */}
            <div className="absolute top-4 right-4 text-white/80">
              <div className="text-sm font-semibold">Local SEO Ranker</div>
              <div className="text-xs">Professional Geo Grid Analysis</div>
            </div>

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="h-8 w-8" />
                  <h1 className="text-3xl font-bold">Geo Grid Scan Report</h1>
                </div>
                
                {/* Scan Information Overlay */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Business</span>
                    </div>
                    <p className="font-semibold">{scanResult.business_name}</p>
                  </div>
                  
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4" />
                      <span className="text-sm font-medium">Keyword</span>
                    </div>
                    <p className="font-semibold">{scanResult.keyword}</p>
                  </div>
                  
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm font-medium">Scan Date & Time</span>
                    </div>
                    <p className="font-semibold">
                      {new Date(`${scanResult.scan_date}T${scanResult.scan_time}`).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="h-4 w-4" />
                      <span className="text-sm font-medium">Average Ranking</span>
                    </div>
                    <p className="font-semibold">
                      {selectedCompetitor ? analytics.average : scanResult.average_ranking}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Export & Settings Actions */}
        <div className="flex justify-end items-center gap-2 mb-6">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share Link
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Full Width Map Container */}
          <div>
            {/* Competitor Selection */}
            {/* Full Width Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Ranking Visualization
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleSettingsClick}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="w-full"
                  style={{
                    height: "700px",
                    minHeight: "700px",
                    overflowAnchor: "auto",
                  }}
                >
                  <GoogleMapComponent
                    center={scanResult.location}
                    zoom={12}
                    height="100%"
                    showControls={true}
                    showDirectionsButton={false}
                    className="h-full border-0 rounded-lg"
                    waypointData={displayWaypoints}
                    onWaypointClick={handleWaypointClick}
                    reportMode={true}
                    scanConfig={{
                      unit: "miles",
                      distanceBetween: 1,
                    }}
                    businessName={scanResult.business_name}
                    businessAddress={scanResult.location.address}
                    keyword={scanResult.keyword}
                    scanDate={scanResult.scan_date}
                    scanTime={scanResult.scan_time}
                    averageRanking={analytics.average}
                    rankingAnalytics={analytics}
                    showBusinessOverlay={true}
                  />
                </div>
                
                {/* Map Legend */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-xs">1-3</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-xs">4-9</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-xs">10-15</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-xs">16-20+</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        <span className="text-xs">Not Found</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      Fixed waypoints • View-only mode
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

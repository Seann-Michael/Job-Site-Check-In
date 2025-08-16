import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MoreVertical,
  Download,
  Share,
  GitCompare,
  Archive,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Send,
  Mail,
  MessageSquare,
  Link2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export interface GeoGridResult {
  id: string;
  businessName: string;
  keyword: string;
  dateRun: string;
  timeRun: string;
  status: "completed" | "running" | "failed" | "pending";
  creditsUsed: number;
  gridSize: string;
  location: string;
  resultCount: number;
  averageRanking: number;
}

// Mock data for demonstration
const MOCK_RESULTS: GeoGridResult[] = [
  {
    id: "1",
    businessName: "Joe's Pizza & More",
    keyword: "pizza restaurant near me",
    dateRun: "2025-01-14",
    timeRun: "14:30",
    status: "completed",
    creditsUsed: 25,
    gridSize: "5x5",
    location: "Fairfield, CA",
    resultCount: 18,
    averageRanking: 3.2,
  },
  {
    id: "2",
    businessName: "Joe's Pizza & More",
    keyword: "italian food fairfield",
    dateRun: "2025-01-14",
    timeRun: "13:15",
    status: "completed",
    creditsUsed: 25,
    gridSize: "5x5",
    location: "Fairfield, CA",
    resultCount: 22,
    averageRanking: 2.8,
  },
  {
    id: "3",
    businessName: "Fairfield Auto Repair",
    keyword: "auto repair near me",
    dateRun: "2025-01-14",
    timeRun: "12:00",
    status: "running",
    creditsUsed: 25,
    gridSize: "7x7",
    location: "Fairfield, CA",
    resultCount: 0,
    averageRanking: 0,
  },
  {
    id: "4",
    businessName: "Joe's Pizza & More",
    keyword: "best pizza delivery",
    dateRun: "2025-01-13",
    timeRun: "16:45",
    status: "completed",
    creditsUsed: 25,
    gridSize: "5x5",
    location: "Fairfield, CA",
    resultCount: 15,
    averageRanking: 4.1,
  },
  {
    id: "5",
    businessName: "Sunshine Dental",
    keyword: "dentist fairfield ca",
    dateRun: "2025-01-13",
    timeRun: "11:30",
    status: "failed",
    creditsUsed: 0,
    gridSize: "5x5",
    location: "Fairfield, CA",
    resultCount: 0,
    averageRanking: 0,
  },
];

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedResults: GeoGridResult[];
}

function ShareDialog({ isOpen, onClose, selectedResults }: ShareDialogProps) {
  const [shareMethod, setShareMethod] = useState<"email" | "sms" | "url">("email");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState(
    `Here are the geo grid ranking results for ${selectedResults.map(r => r.keyword).join(", ")}. Check out how your business is performing across different locations!`
  );
  
  const publicUrl = `https://yourdomain.com/shared/geo-results/${selectedResults.map(r => r.id).join(",")}`;

  const handleShare = async () => {
    try {
      if (shareMethod === "email") {
        // Email sharing logic
        console.log("Sending email to:", recipient, "Message:", message);
        toast.success("Email sent successfully!");
      } else if (shareMethod === "sms") {
        // SMS sharing logic
        console.log("Sending SMS to:", recipient, "Message:", message);
        toast.success("SMS sent successfully!");
      }
      onClose();
    } catch (error) {
      toast.error("Failed to share results");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("URL copied to clipboard!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Geo Grid Results</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Share Method</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button
                variant={shareMethod === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setShareMethod("email")}
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
              <Button
                variant={shareMethod === "sms" ? "default" : "outline"}
                size="sm"
                onClick={() => setShareMethod("sms")}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                SMS
              </Button>
              <Button
                variant={shareMethod === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setShareMethod("url")}
              >
                <Link2 className="h-4 w-4 mr-1" />
                URL
              </Button>
            </div>
          </div>

          {shareMethod === "url" ? (
            <div className="space-y-2">
              <Label>Public URL</Label>
              <div className="flex items-center gap-2">
                <Input value={publicUrl} readOnly className="flex-1" />
                <Button size="sm" variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label>{shareMethod === "email" ? "Email Address" : "Phone Number"}</Label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={shareMethod === "email" ? "client@example.com" : "+1 (555) 123-4567"}
                />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={handleShare} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                Send {shareMethod === "email" ? "Email" : "SMS"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GeoGridResultsTableProps {
  results?: GeoGridResult[];
  onCompare?: (results: GeoGridResult[]) => void;
  onDownload?: (results: GeoGridResult[]) => void;
  onArchive?: (results: GeoGridResult[]) => void;
}

export function GeoGridResultsTable({
  results = MOCK_RESULTS,
  onCompare,
  onDownload,
  onArchive,
}: GeoGridResultsTableProps) {
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const getStatusBadge = (status: GeoGridResult["status"]) => {
    const config = {
      completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      running: { color: "bg-blue-100 text-blue-800", icon: Clock },
      failed: { color: "bg-red-100 text-red-800", icon: AlertCircle },
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
    };
    
    const { color, icon: Icon } = config[status];
    return (
      <Badge className={`${color} capitalize`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedResults(checked ? results.map(r => r.id) : []);
  };

  const handleSelectResult = (resultId: string, checked: boolean) => {
    setSelectedResults(prev =>
      checked 
        ? [...prev, resultId]
        : prev.filter(id => id !== resultId)
    );
  };

  const getSelectedResults = () => {
    return results.filter(r => selectedResults.includes(r.id));
  };

  const handleBulkAction = (action: string) => {
    const selected = getSelectedResults();
    
    switch (action) {
      case "compare":
        onCompare?.(selected);
        break;
      case "share":
        setShowShareDialog(true);
        break;
      case "download":
        onDownload?.(selected);
        toast.success(`Downloading ${selected.length} results...`);
        break;
      case "archive":
        onArchive?.(selected);
        toast.success(`Archived ${selected.length} results`);
        setSelectedResults([]);
        break;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Geo Grid Ranking Results
          </CardTitle>
          
          {selectedResults.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedResults.length} selected
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Bulk Actions
                    <MoreVertical className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkAction("compare")}>
                    <GitCompare className="h-4 w-4 mr-2" />
                    Compare
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction("share")}>
                    <Share className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction("download")}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction("archive")}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedResults.length === results.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Business Name</TableHead>
              <TableHead>Keyword</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Credits Used</TableHead>
              <TableHead>Grid Size</TableHead>
              <TableHead>Results</TableHead>
              <TableHead>Avg Ranking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow key={result.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedResults.includes(result.id)}
                    onCheckedChange={(checked) => 
                      handleSelectResult(result.id, !!checked)
                    }
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {result.businessName}
                </TableCell>
                <TableCell>{result.keyword}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span>{result.dateRun}</span>
                    <span className="text-muted-foreground">{result.timeRun}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(result.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-green-600" />
                    <span>{result.creditsUsed}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{result.gridSize}</Badge>
                </TableCell>
                <TableCell>
                  {result.status === "completed" ? result.resultCount : "-"}
                </TableCell>
                <TableCell>
                  {result.status === "completed" ? (
                    <Badge 
                      variant="outline" 
                      className={
                        result.averageRanking <= 3 
                          ? "border-green-200 bg-green-50 text-green-800"
                          : result.averageRanking <= 7
                          ? "border-yellow-200 bg-yellow-50 text-yellow-800"
                          : "border-red-200 bg-red-50 text-red-800"
                      }
                    >
                      #{result.averageRanking}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        selectedResults={getSelectedResults()}
      />
    </Card>
  );
}

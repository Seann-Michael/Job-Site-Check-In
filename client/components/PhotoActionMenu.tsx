import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Edit,
  Trash2,
  Star,
  Download,
  Info,
  Share,
} from "lucide-react";

interface PhotoActionMenuProps {
  photo: any;
  index?: number;
  projectName?: string;
  onEdit?: (photo: any) => void;
  onDelete?: (photo: any) => void;
  onToggleFavorite?: (photo: any) => void;
  onDownload?: (photo: any) => void;
  onShare?: (photo: any) => void;
  onViewDetails?: (photo: any) => void;
  isFavorite?: boolean;
  className?: string;
}

export function PhotoActionMenu({
  photo,
  index = 0,
  projectName = "photo",
  onEdit,
  onDelete,
  onToggleFavorite,
  onDownload,
  onShare,
  onViewDetails,
  isFavorite = false,
  className = "",
}: PhotoActionMenuProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload(photo);
    } else {
      // Default download behavior
      const photoUrl = typeof photo === "string" ? photo : photo.url;
      const a = document.createElement("a");
      a.href = photoUrl;
      a.download = `${projectName}-photo-${index + 1}.jpg`;
      a.click();
    }
  };

  const handleEdit = () => {
    onEdit?.(photo);
  };

  const handleDelete = () => {
    onDelete?.(photo);
  };

  const handleToggleFavorite = () => {
    onToggleFavorite?.(photo);
  };

  const handleShare = () => {
    if (onShare) {
      onShare(photo);
    } else {
      // Default share behavior
      const photoUrl = typeof photo === "string" ? photo : photo.url;
      if (navigator.share) {
        navigator.share({
          title: `Photo from ${projectName}`,
          url: photoUrl,
        });
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(photoUrl);
        // Note: Would need to show a toast here in real implementation
      }
    }
  };

  const handleViewDetails = () => {
    onViewDetails?.(photo);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0 z-10 ${className}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleToggleFavorite} className="gap-2">
          <Star
            className={`h-4 w-4 ${isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
          />
          {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleShare} className="gap-2">
          <Share className="h-4 w-4" />
          Share
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleViewDetails} className="gap-2">
          <Info className="h-4 w-4" />
          Edit Metadata
        </DropdownMenuItem>

        {onDelete && (
          <>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleDelete}
              className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

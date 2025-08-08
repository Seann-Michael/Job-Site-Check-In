import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  value?: string;
  onChange?: (fileUrl: string) => void;
  onRemove?: () => void;
  accept?: string;
  maxSize?: number; // in MB
  label?: string;
  description?: string;
  previewClassName?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  value,
  onChange,
  onRemove,
  accept = "image/*",
  maxSize = 5, // 5MB default
  label = "Upload File",
  description,
  previewClassName = "w-20 h-20",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File size must be less than ${maxSize}MB`);
      return;
    }

    // Validate file type
    if (accept === "image/*" && !file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setIsUploading(true);

    try {
      // For demo purposes, create a data URL
      // In production, you would upload to your server/cloud storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (onChange) {
          onChange(dataUrl);
        }
        toast.success("File uploaded successfully");
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("Failed to upload file");
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    } else if (onChange) {
      onChange("");
    }
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      
      {/* Preview */}
      {value && (
        <div className={`border rounded-lg overflow-hidden ${previewClassName} relative group`}>
          {accept === "image/*" ? (
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <ImageIcon className="h-8 w-8 text-gray-400" />
            </div>
          )}
          
          {/* Remove button overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Upload Controls */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleUploadClick}
          disabled={isUploading}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? "Uploading..." : value ? "Change" : "Upload"}
        </Button>
        
        {value && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRemove}
          >
            Remove
          </Button>
        )}
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Hidden file input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

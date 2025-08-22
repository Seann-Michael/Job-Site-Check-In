import React, { useState, useRef, useCallback } from 'react';
import { Button } from './button';
import { Progress } from './progress';
import { Card, CardContent } from './card';
import { 
  Paperclip, 
  Upload, 
  X, 
  File, 
  Image, 
  Video, 
  Music, 
  FileText,
  Archive,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  onUpload?: (files: UploadFile[]) => Promise<void>;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: string;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  showPreview?: boolean;
  autoUpload?: boolean;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  preview?: string;
}

const getFileIcon = (fileType: string, size = 16) => {
  const className = `h-${size/4} w-${size/4}`;
  
  if (fileType.startsWith('image/')) {
    return <Image className={className} />;
  } else if (fileType.startsWith('video/')) {
    return <Video className={className} />;
  } else if (fileType.startsWith('audio/')) {
    return <Music className={className} />;
  } else if (fileType === 'application/pdf' || fileType.includes('document') || fileType.includes('text')) {
    return <FileText className={className} />;
  } else if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) {
    return <Archive className={className} />;
  } else {
    return <File className={className} />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const generatePreview = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } else {
      resolve(null);
    }
  });
};

export function FileUpload({
  onFileSelect,
  onUpload,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  accept,
  multiple = true,
  className,
  disabled = false,
  showPreview = true,
  autoUpload = false
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileValidation = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)}`;
    }
    
    if (accept) {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        } else if (type.includes('*')) {
          const baseType = type.split('/')[0];
          return file.type.startsWith(baseType);
        } else {
          return file.type === type;
        }
      });
      
      if (!isAccepted) {
        return `File type not supported. Accepted: ${accept}`;
      }
    }
    
    return null;
  };

  const processFiles = useCallback(async (fileList: File[]) => {
    if (disabled) return;
    
    const validFiles = fileList.slice(0, maxFiles - files.length);
    const newFiles: UploadFile[] = [];

    for (const file of validFiles) {
      const error = handleFileValidation(file);
      const preview = showPreview ? await generatePreview(file) : undefined;
      
      const uploadFile: UploadFile = {
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        progress: 0,
        status: error ? 'error' : 'pending',
        error,
        preview
      };
      
      newFiles.push(uploadFile);
    }

    setFiles(prev => [...prev, ...newFiles]);
    onFileSelect(newFiles.filter(f => !f.error).map(f => f.file));

    if (autoUpload && onUpload) {
      await onUpload(newFiles.filter(f => !f.error));
    }
  }, [files, maxFiles, disabled, showPreview, autoUpload, onUpload, onFileSelect, handleFileValidation]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    processFiles(fileList);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const fileList = Array.from(e.dataTransfer.files);
    processFiles(fileList);
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const retryUpload = async (file: UploadFile) => {
    if (!onUpload) return;
    
    setFiles(prev => prev.map(f => 
      f.id === file.id 
        ? { ...f, status: 'pending', error: undefined }
        : f
    ));
    
    await onUpload([file]);
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all',
          isDragOver 
            ? 'border-primary bg-primary/5 scale-102' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex flex-col items-center space-y-2">
          <div className={cn(
            'rounded-full p-3 transition-colors',
            isDragOver ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            <Upload className="h-6 w-6" />
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragOver ? 'Drop files here' : 'Click to upload or drag & drop'}
            </p>
            <p className="text-xs text-muted-foreground">
              {accept 
                ? `Supported: ${accept}` 
                : `Max ${formatFileSize(maxSize)} per file`
              }
              {multiple && ` • Up to ${maxFiles} files`}
            </p>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            Files ({files.length}/{maxFiles})
          </h4>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((uploadFile) => (
              <Card key={uploadFile.id} className="p-3">
                <div className="flex items-center space-x-3">
                  {/* File Icon/Preview */}
                  <div className="flex-shrink-0">
                    {uploadFile.preview ? (
                      <img 
                        src={uploadFile.preview} 
                        alt={uploadFile.file.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        {getFileIcon(uploadFile.file.type, 20)}
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(uploadFile.file.size)}
                    </p>
                    
                    {/* Progress Bar */}
                    {uploadFile.status === 'uploading' && (
                      <Progress value={uploadFile.progress} className="mt-1 h-1" />
                    )}
                    
                    {/* Error Message */}
                    {uploadFile.error && (
                      <p className="text-xs text-destructive mt-1">
                        {uploadFile.error}
                      </p>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {uploadFile.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {uploadFile.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    {uploadFile.status === 'uploading' && (
                      <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex-shrink-0 flex space-x-1">
                    {uploadFile.status === 'error' && onUpload && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          retryUpload(uploadFile);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(uploadFile.id);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upload All Button */}
      {!autoUpload && onUpload && files.some(f => f.status === 'pending') && (
        <div className="flex justify-end">
          <Button
            onClick={() => onUpload(files.filter(f => f.status === 'pending'))}
            disabled={disabled}
            className="w-full sm:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload {files.filter(f => f.status === 'pending').length} file(s)
          </Button>
        </div>
      )}
    </div>
  );
}

// Simple file upload button component
interface FileUploadButtonProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function FileUploadButton({
  onFileSelect,
  accept,
  multiple = false,
  disabled = false,
  children,
  className
}: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onFileSelect(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className={className}
      >
        {children || <Paperclip className="h-4 w-4" />}
      </Button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />
    </>
  );
}

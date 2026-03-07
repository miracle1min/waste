import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Upload, X, CheckCircle, FileImage } from "lucide-react";
import { Button } from "./button";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  file?: File;
  label: string;
  description?: string;
  accept?: Record<string, string[]>;
  maxSize?: number;
  className?: string;
}

export function FileUploadZone({
  onFileSelect,
  onFileRemove,
  file,
  label,
  description,
  accept = { 'image/*': ['.png', '.jpg', '.jpeg', '.svg'] },
  maxSize = 5 * 1024 * 1024, // 5MB
  className
}: FileUploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File terlalu besar. Maksimal 5MB.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Tipe file tidak didukung. Gunakan PNG, JPG, atau SVG.');
      } else {
        setError('File tidak valid.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false
  });

  const hasFile = !!file;

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      
      <div
        {...getRootProps()}
        className={cn(
          "file-upload-area min-h-[120px] sm:min-h-[140px] cursor-pointer",
          hasFile && "has-file",
          isDragActive && "border-primary bg-blue-50 dark:bg-blue-950 scale-102",
          error && "border-destructive bg-destructive/5"
        )}
      >
        <input {...getInputProps()} />
        
        {hasFile ? (
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <FileImage className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onFileRemove();
                setError(null);
              }}
              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="py-6">
            <div className="flex flex-col items-center space-y-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? "Lepas file di sini" : "Klik atau drag file ke sini"}
                </p>
                {description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG, SVG maksimal 5MB
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
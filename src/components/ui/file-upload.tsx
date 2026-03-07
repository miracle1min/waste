import { useState, useRef, forwardRef } from "react";
import { Upload, X, CloudUpload, CheckCircle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import imageCompression from 'browser-image-compression';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  acceptedTypes?: string[];
  maxSize?: number;
  maxSizeInMB?: number;
  className?: string;
}

export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(({ 
  onFileSelect, 
  accept = "image/*", 
  acceptedTypes = ["image/jpeg", "image/png", "image/jpg"],
  maxSize = 5 * 1024 * 1024, 
  maxSizeInMB = 5,
  className 
}: FileUploadProps, ref) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.9, // 0.9 MB as requested
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      // Keep original name
      const newFile = new File([compressedFile], file.name, {
        type: compressedFile.type,
      });
      return newFile;
    } catch (error) {
      console.error('Compression error:', error);
      return file; // Return original if compression fails
    }
  };

  const handleFileChange = async (file: File | null) => {
    setError(null);
    setIsCompressing(false);
    
    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      onFileSelect(null);
      return;
    }

    // Validate file type first
    if (acceptedTypes && acceptedTypes.length > 0) {
      if (!acceptedTypes.includes(file.type)) {
        const errorMsg = 'Format file tidak didukung. Gunakan: JPG, PNG, JPEG';
        setError(errorMsg);
        return;
      }
    } else if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar');
      return;
    }

    try {
      setIsCompressing(true);
      
      // Compress the image to 0.9MB
      const compressedFile = await compressImage(file);
      
      setSelectedFile(compressedFile);
      onFileSelect(compressedFile);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
        setIsCompressing(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      setError('Gagal memproses gambar');
      setIsCompressing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (selectedFile && preview) {
    return (
      <div className={cn("space-y-2 sm:space-y-3 file-preview-mobile", className)}>
        <div className="relative bg-muted/50 rounded-lg p-2 sm:p-3 border border-border/50">
          <div className="relative overflow-hidden rounded">
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full h-16 sm:h-20 object-cover" 
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full shadow-lg"
                onClick={removeFile}
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="px-1 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-4 h-4 bg-green-100 dark:bg-green-900 rounded flex items-center justify-center">
              <CheckCircle className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-muted-foreground file-name-mobile flex-1">
              {selectedFile.name}
            </p>
          </div>
          <p className="text-xs text-muted-foreground text-center file-size-mobile">
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 sm:space-y-3", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-200 flex flex-col justify-center file-upload-mobile",
          "p-3 sm:p-6 min-h-[100px] sm:min-h-[120px]",
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/50 hover:border-primary hover:bg-primary/5"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="space-y-2 sm:space-y-3">
          <div className={cn(
            "w-8 h-8 sm:w-10 sm:h-10 mx-auto rounded-full flex items-center justify-center",
            isDragOver ? "bg-primary/20" : "bg-muted/50"
          )}>
            <CloudUpload className={cn(
              "h-4 w-4 sm:h-6 sm:w-6",
              isDragOver ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div className="px-2">
            <p className="text-xs sm:text-sm font-medium mb-1">
              {isCompressing ? "Mengompres gambar..." : "Upload File"}
            </p>
            <p className="text-xs text-muted-foreground">
              Klik atau drag & drop di sini
            </p>
            <p className="text-xs text-muted-foreground mt-1 opacity-75">
              JPG, PNG • Max 5MB • Auto kompres
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
      {error && (
        <div className="mt-2 p-2 sm:p-3 bg-destructive/10 border border-destructive/20 rounded-md text-xs sm:text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
});

FileUpload.displayName = "FileUpload";

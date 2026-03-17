import { useState, useRef, forwardRef } from "react";
import { Upload, X, CloudUpload, Plus } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import imageCompression from 'browser-image-compression';

interface MultiFileUploadProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  acceptedTypes?: string[];
  maxFiles?: number;
  className?: string;
  label?: string;
}

export const MultiFileUpload = forwardRef<HTMLInputElement, MultiFileUploadProps>(({ 
  onFilesSelect, 
  accept = "image/*", 
  acceptedTypes = ["image/jpeg", "image/png", "image/jpg"],
  maxFiles = 10,
  className,
  label = "Upload Files"
}: MultiFileUploadProps, ref) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.9, // 0.9 MB as requested
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      // Keep original name but add compressed suffix if needed
      const newFile = new File([compressedFile], file.name, {
        type: compressedFile.type,
      });
      return newFile;
    } catch (error) {
      console.error('Compression error:', error);
      return file; // Return original if compression fails
    }
  };

  const handleFileChange = async (newFiles: FileList | File[]) => {
    setError(null);
    setIsCompressing(true);
    
    const filesArray = Array.from(newFiles);
    
    // Check if adding these files would exceed maxFiles
    if (selectedFiles.length + filesArray.length > maxFiles) {
      setError(`Maksimal ${maxFiles} file dapat diupload`);
      setIsCompressing(false);
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of filesArray) {
      // Validate file type
      if (acceptedTypes && acceptedTypes.length > 0) {
        if (!acceptedTypes.includes(file.type)) {
          setError('Format file tidak didukung. Gunakan: JPG, PNG, JPEG');
          continue;
        }
      } else if (!file.type.startsWith('image/')) {
        setError('File harus berupa gambar');
        continue;
      }

      try {
        // Compress the image
        const compressedFile = await compressImage(file);
        validFiles.push(compressedFile);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string);
          if (newPreviews.length === validFiles.length) {
            const updatedFiles = [...selectedFiles, ...validFiles];
            const updatedPreviews = [...previews, ...newPreviews];
            
            setSelectedFiles(updatedFiles);
            setPreviews(updatedPreviews);
            onFilesSelect(updatedFiles);
            setIsCompressing(false);
          }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Error processing file:', error);
        setError('Gagal memproses file');
      }
    }

    if (validFiles.length === 0) {
      setIsCompressing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileChange(files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileChange(files);
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

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    
    setSelectedFiles(updatedFiles);
    setPreviews(updatedPreviews);
    onFilesSelect(updatedFiles);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addMoreFiles = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Upload Area */}
      {selectedFiles.length === 0 && (
        <div
          className={cn(
            "border-2 border-dashed rounded-[16px] p-4 sm:p-6 text-center transition-all duration-200 cursor-pointer min-h-[120px] flex flex-col justify-center",
            isDragOver 
              ? "border-[#4FD1FF]/40 bg-[#4FD1FF]/5 shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)]" 
              : "border-[rgba(79,209,255,0.15)] bg-[#23262F] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.03)]",
            "hover:border-[#4FD1FF]/30 hover:bg-[#4FD1FF]/5"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="space-y-2">
            <CloudUpload className={cn(
              "w-8 h-8 sm:w-10 sm:h-10 mx-auto",
              isDragOver ? "text-[#4FD1FF]" : "text-[#6B7280]"
            )} />
            <div className="px-2">
              <p className="text-sm font-medium text-[#E5E7EB]">
                {isCompressing ? "Memproses gambar..." : `${label} (Maks ${maxFiles} file)`}
              </p>
              <p className="text-xs text-[#6B7280] mt-1">
                Drag & drop atau klik untuk memilih
              </p>
              <p className="text-xs text-[#6B7280]">
                Format: JPG, PNG, JPEG • Auto resize ke 0.9MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File Previews */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative bg-[#2A2D37] border border-[rgba(79,209,255,0.08)] rounded-[12px] p-2 sm:p-3 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)] file-preview-mobile">
                <div className="relative overflow-hidden rounded-[8px] mb-2">
                  <img 
                    src={previews[index]} 
                    alt={`Preview ${index + 1}`} 
                    className="w-full h-14 sm:h-16 object-cover" 
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-5 w-5 sm:h-6 sm:w-6 p-0 rounded-full shadow-lg"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-center text-[#E5E7EB] file-name-mobile leading-tight">{file.name}</p>
                  <p className="text-xs text-center text-[#6B7280] file-size-mobile">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Add More Button */}
          {selectedFiles.length < maxFiles && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMoreFiles}
              className="w-full min-h-[44px] text-sm"
              disabled={isCompressing}
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Dokumentasi ({selectedFiles.length}/{maxFiles})
            </Button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-[#F87171] text-center">{error}</p>
      )}

      {isCompressing && (
        <p className="text-sm text-[#9CA3AF] text-center">
          Mengompres gambar untuk optimasi ukuran...
        </p>
      )}
    </div>
  );
});

MultiFileUpload.displayName = "MultiFileUpload";

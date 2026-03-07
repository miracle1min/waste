
import { useState, useRef, forwardRef } from "react";
import { Upload, X, CloudUpload, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "./button";
import { Label } from "./label";
import { cn } from "@/lib/utils";
import { FileUpload } from "./file-upload";

interface ParafSelectorProps {
  value?: File;
  onValueChange: (value: File | undefined) => void;
  label: string;
  description?: string;
  className?: string;
}

export function ParafSelector({
  value,
  onValueChange,
  label,
  description,
  className
}: ParafSelectorProps) {
  const handleFileSelect = (file: File | null) => {
    onValueChange(file || undefined);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      <FileUpload
        onFileSelect={handleFileSelect}
        accept="image/*"
        acceptedTypes={["image/jpeg", "image/png", "image/jpg", "image/svg+xml"]}
        maxSize={5 * 1024 * 1024}
        maxSizeInMB={5}
        className="w-full"
      />

      {value && (
        <div className="mt-3 p-2 sm:p-3 bg-success/10 rounded-lg border border-success/20">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-12 h-8 sm:w-16 sm:h-10 bg-white border rounded overflow-hidden">
              <img 
                src={URL.createObjectURL(value)} 
                alt="Paraf QC"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-foreground">Paraf QC Terpilih:</p>
              <p className="text-xs text-muted-foreground truncate">{value.name}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onValueChange(undefined)}
              className="text-destructive hover:text-destructive h-6 w-6 sm:h-8 sm:w-8 p-0 flex-shrink-0"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

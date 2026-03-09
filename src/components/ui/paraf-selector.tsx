import { useState, useEffect } from "react";
import { CheckCircle, ChevronDown, Trash2, User, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Label } from "./label";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

interface QCSig {
  name: string;
  full_name: string;
  url: string | null;
}

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
  const [selectedName, setSelectedName] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qcList, setQcList] = useState<QCSig[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Load QC list from API
  useEffect(() => {
    async function fetchQC() {
      setListLoading(true);
      try {
        const tenantId = localStorage.getItem("tenant_id") || "";
        const res = await apiFetch(`/api/signatures?tenant_id=${tenantId}&role=qc`);
        const data = await res.json();
        if (data.success && data.personnel) {
          setQcList(data.personnel);
        }
      } catch (e) {
        console.error("Failed to load QC list:", e);
      } finally {
        setListLoading(false);
      }
    }
    fetchQC();
  }, []);

  const handleSelect = async (person: QCSig) => {
    setIsOpen(false);
    if (!person.url) return;
    setLoading(true);
    setSelectedName(person.full_name);
    try {
      const response = await fetch(person.url);
      const blob = await response.blob();
      const fileName = person.name.toLowerCase() + ".jpeg";
      const file = new File([blob], fileName, { type: "image/jpeg" });
      onValueChange(file);
    } catch (e) {
      console.error("Failed to load signature:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedName("");
    onValueChange(undefined);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={listLoading}
          className="w-full flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 bg-card border border-border rounded-lg text-left hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {listLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
            <span className={cn("text-sm", selectedName ? "text-foreground" : "text-muted-foreground")}>
              {listLoading ? "Loading QC..." : selectedName || "Pilih nama QC..."}
            </span>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {qcList.map((person) => (
              <button
                key={person.name}
                type="button"
                onClick={() => handleSelect(person)}
                className="w-full flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-accent/50 transition-colors text-left"
              >
                <div className="flex-shrink-0 w-10 h-7 sm:w-12 sm:h-8 bg-white border rounded overflow-hidden">
                  {person.url ? (
                    <img src={person.url} alt={person.full_name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-gray-400 flex items-center justify-center h-full">No TTD</span>
                  )}
                </div>
                <span className="text-sm font-medium">{person.full_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground animate-pulse">Memuat tanda tangan...</p>
      )}

      {value && selectedName && !loading && (
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
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-success" />
                <p className="text-xs sm:text-sm font-medium text-foreground">Paraf QC: {selectedName}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
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

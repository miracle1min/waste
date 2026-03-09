import { useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle, FileText, Upload, Save, RotateCcw, Send, Sparkles, Edit, Trash2, X, LogOut, Download, AlertTriangle, BarChart3 } from "lucide-react";
import { useStableCallback, useDebounce, usePerformanceMonitor } from "@/hooks/usePerformanceOptimization";
import { parseApiError, getUserFriendlyErrorMessage, retryRequest } from "@/utils/errorHandler";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, withTenantParam } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
// Theme is always dark (cyberpunk)
import { StepWizard } from "@/components/ui/step-wizard";
import { CategorySelector } from "@/components/ui/category-selector";
import { FileUploadZone } from "@/components/ui/file-upload-zone";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { ParafSelector } from "@/components/ui/paraf-selector";
import { ParafManagerSelector } from "@/components/ui/paraf-manager-selector";
import { Footer } from "@/components/ui/footer";
import { insertIndividualProductWithFilesSchema } from "@shared/schema";
import { getCurrentWIBDateString, formatWIBForInput, formatWIBForDisplay, formatWIBIndonesian } from "@shared/timezone";
import type { z } from "zod";
import wasteLogo from "@assets/waste-logo_1753322218969.webp";

// Predefined product lists for specific stations
const PREDEFINED_PRODUCTS = {
  DIMSUM: ["UDANG KEJU", "UDANG RAMBUTAN", "LUMPIA UDANG", "SIOMAY"],
  PRODUKSI: ["KULIT PANGSIT", "PANGSIT GORENG", "CABE"]
};

type Shift = 'OPENING' | 'MIDDLE' | 'CLOSING' | 'MIDNIGHT';

const SHIFTS: { id: Shift; label: string; active: string; inactive: string }[] = [
  { id: 'OPENING', label: 'Opening', active: 'bg-yellow-500 border-yellow-400 text-black shadow-lg shadow-yellow-500/30', inactive: 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300 hover:bg-yellow-900/40 hover:border-yellow-500' },
  { id: 'MIDDLE', label: 'Middle', active: 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/30', inactive: 'bg-blue-900/20 border-blue-700/50 text-blue-300 hover:bg-blue-900/40 hover:border-blue-500' },
  { id: 'CLOSING', label: 'Closing', active: 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/30', inactive: 'bg-purple-900/20 border-purple-700/50 text-purple-300 hover:bg-purple-900/40 hover:border-purple-500' },
  { id: 'MIDNIGHT', label: 'Midnight', active: 'bg-gray-500 border-gray-400 text-white shadow-lg shadow-gray-500/30', inactive: 'bg-gray-900/20 border-gray-700/50 text-gray-300 hover:bg-gray-900/40 hover:border-gray-500' },
];

// Store name from logged-in user tenant

type WasteItem = z.infer<typeof insertIndividualProductWithFilesSchema>;
type Category = "NOODLE" | "DIMSUM" | "BAR" | "PRODUKSI";

type CategoryGroup = {
  kategoriInduk: Category;
  items: WasteItem[];
};

type ItemRow = {
  namaProduk: string;
  kodeProduk: string;
  jumlahProduk: number | string;
  unit: string;
  metodePemusnahan: string;
  alasanPemusnahan: string;
  alasanPemusnahanManual: string;
  customProductName: string;
};

type Step = "date" | "category" | "products" | "files" | "review";

const STEPS = [
  { id: "date", title: "Tanggal", description: "Pilih tanggal kerja lo" },
  { id: "category", title: "Kategori", description: "Mau buang yang mana?" },
  { id: "products", title: "Produk", description: "Isi detail produknya" },
  { id: "files", title: "Dokumen", description: "Upload berkasnya" },
  { id: "review", title: "Review", description: "Cek sebelum kirim" },
];

// Simple logout button component
function LogoutButton() {
  const { logout, isLoggingOut, tenantName} = useAuth();
  
  const handleLogout = async () => {
    console.log("Logout button clicked");
    
    try {
      logout();
      console.log("Logout function called successfully");
      
      // Add a small delay to show the loading state before reload
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="p-2 w-10 h-10 text-slate-400 hover:text-cyan-400 border border-transparent hover:border-cyan-800/50 transition-colors duration-200"
      title="Logout"
    >
      {isLoggingOut ? (
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <LogOut className="w-4 h-4" />
      )}
    </Button>
  );
}

export default function ProductDestruction() {
  // Performance monitoring
  const { logRenderInfo } = usePerformanceMonitor('ProductDestruction');
  const { tenantName } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<Step>("date");
  const [completedSteps, setCompletedSteps] = useState<Step[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentWIBDateString());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift>('OPENING');
  const [storeName, setStoreName] = useState<string>('');

  // Set store name from logged-in user's tenant
  useEffect(() => {
    if (tenantName) setStoreName(tenantName);
  }, [tenantName]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [showPdfButton, setShowPdfButton] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [customProductName, setCustomProductName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const emptyItemRow: ItemRow = { namaProduk: '', kodeProduk: '', jumlahProduk: 1, unit: '', metodePemusnahan: '', alasanPemusnahan: '', alasanPemusnahanManual: '', customProductName: '' };
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ ...emptyItemRow }]);
  const { toast } = useToast();
  const productFormRef = useRef<HTMLDivElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [shiftStationStatus, setShiftStationStatus] = useState<Record<string, string[]>>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusRefreshTrigger, setStatusRefreshTrigger] = useState(0);
  const cacheRestoredRef = useRef(false);

  // Auto-scroll to product form when entering products step
  useEffect(() => {
    if (currentStep === "products" && productFormRef.current) {
      productFormRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [currentStep]);

  // === SECURITY: Prevent accidental navigation (back/close/refresh) ===
  useEffect(() => {
    const hasUnsavedData = categoryGroups.some(g => g.items.length > 0) ||
      itemRows.some(r => r.namaProduk.trim() !== '');

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = 'Data belum kesimpen! Yakin mau ninggalin halaman ini?';
      }
    };

    const handlePopState = () => {
      if (hasUnsavedData) {
        if (!window.confirm('Data belum kesimpen! Yakin mau balik?')) {
          window.history.pushState(null, '', window.location.pathname);
        }
      }
    };

    if (hasUnsavedData) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [categoryGroups, itemRows]);

  // === CACHING: Save form state to localStorage ===
  const CACHE_KEY = 'waste_form_cache';

  // Restore cache on mount (only once)
  useEffect(() => {
    if (cacheRestoredRef.current) return;
    cacheRestoredRef.current = true;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const hasData = data.categoryGroups?.some((g: CategoryGroup) => g.items.length > 0);
        if (hasData && window.confirm('Ada data sebelumnya yang belum selesai. Mau lanjutkan?')) {
          if (data.selectedDate) setSelectedDate(data.selectedDate);
          if (data.selectedShift) setSelectedShift(data.selectedShift);
          if (data.storeName) setStoreName(data.storeName);
          if (data.selectedCategory) setSelectedCategory(data.selectedCategory);
          if (data.categoryGroups) setCategoryGroups(data.categoryGroups);
          if (data.currentStep) setCurrentStep(data.currentStep);
          if (data.completedSteps) setCompletedSteps(data.completedSteps);
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (e) {
      console.warn('Failed to restore cache:', e);
    }
  }, []);

  // Save to cache whenever state changes
  useEffect(() => {
    if (!cacheRestoredRef.current) return;
    try {
      const hasData = categoryGroups.some(g => g.items.length > 0);
      if (hasData) {
        // Strip non-serializable fields (File objects) from categoryGroups
        const serializableGroups = categoryGroups.map(g => ({
          ...g,
          items: g.items.map(item => ({
            ...item,
            dokumentasiFile: undefined,
            dokumentasiFiles: undefined,
            parafQCFile: undefined,
            parafManagerFile: undefined,
          }))
        }));
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          selectedDate,
          selectedShift,
          storeName,
          selectedCategory,
          categoryGroups: serializableGroups,
          currentStep,
          completedSteps,
        }));
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save cache:', e);
    }
  }, [selectedDate, selectedShift, storeName, selectedCategory, categoryGroups, currentStep, completedSteps]);

  // === STATUS: Fetch shift/station status for selected date ===
  useEffect(() => {
    if (!selectedDate) return;
    setIsLoadingStatus(true);
    apiFetch(`/api/get-day-data?date=${selectedDate}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.grouped) {
          const status: Record<string, string[]> = {};
          Object.keys(data.grouped).forEach(shift => {
            status[shift] = (data.grouped[shift] || []).map((entry: any) => entry.station?.toUpperCase());
          });
          setShiftStationStatus(status);
        } else {
          setShiftStationStatus({});
        }
      })
      .catch(() => setShiftStationStatus({}))
      .finally(() => setIsLoadingStatus(false));
  }, [selectedDate, statusRefreshTrigger]);

  const form = useForm<WasteItem>({
    resolver: zodResolver(insertIndividualProductWithFilesSchema),
    defaultValues: {
      tanggal: selectedDate,
      kategoriInduk: "NOODLE",
      namaProduk: "",
      kodeProduk: "",
      jumlahProduk: 1,
      unit: "",
      metodePemusnahan: "",
      alasanPemusnahan: "",
      alasanPemusnahanManual: "",
      jamTanggalPemusnahan: formatWIBForInput(),
      parafQCName: "",
      parafManagerName: "",
      dokumentasiUrl: "",
      parafQCFile: undefined,
      parafManagerFile: undefined,
      dokumentasiFile: undefined,
    },
  });

  // Update jamTanggalPemusnahan with current WIB time in real-time
  useEffect(() => {
    const updateDateTime = () => {
      const currentWIBTime = formatWIBForInput();
      // Only update if not in edit mode
      if (editingIndex === null) {
        form.setValue("jamTanggalPemusnahan", currentWIBTime);
      }
    };

    // Set initial value
    updateDateTime();

    // Update every minute (60000ms), but only when not editing
    const interval = setInterval(updateDateTime, 60000);

    return () => clearInterval(interval);
  }, [form, editingIndex]);

  const submitMutation = useMutation({
    mutationFn: useStableCallback(async (categoryGroup: CategoryGroup) => {
      const formData = new FormData();
      
      // Basic group data
      formData.append('tanggal', selectedDate);
      formData.append('kategoriInduk', categoryGroup.kategoriInduk);
      formData.append('shift', selectedShift);
      formData.append('storeName', storeName);
      
      // Extract arrays for grouped data
      const productList = categoryGroup.items.map(item => item.namaProduk);
      const kodeProdukList = categoryGroup.items.map(item => item.kodeProduk);
      const jumlahProdukList = categoryGroup.items.map(item => typeof item.jumlahProduk === 'string' ? parseInt(item.jumlahProduk) || 1 : item.jumlahProduk);
      const unitList = categoryGroup.items.map(item => item.unit);
      const metodePemusnahanList = categoryGroup.items.map(item => item.metodePemusnahan);
      const alasanPemusnahanList = categoryGroup.items.map(item => {
        // Combine dropdown selection and manual input
        const dropdown = item.alasanPemusnahan || '';
        const manual = item.alasanPemusnahanManual || '';
        if (dropdown && manual) {
          return `${dropdown} - ${manual}`;
        } else if (dropdown) {
          return dropdown;
        } else if (manual) {
          return manual;
        } else {
          return '';
        }
      });
      
      // Use common values from first item (since they're grouped by category)
      const firstItem = categoryGroup.items[0];
      
      formData.append('productList', JSON.stringify(productList));
      formData.append('kodeProdukList', JSON.stringify(kodeProdukList));
      formData.append('jumlahProdukList', JSON.stringify(jumlahProdukList));
      formData.append('unitList', JSON.stringify(unitList));
      formData.append('metodePemusnahanList', JSON.stringify(metodePemusnahanList));
      formData.append('alasanPemusnahanList', JSON.stringify(alasanPemusnahanList));
      // Send per-item jam list for multi-line display in PDF
      const jamList = categoryGroup.items.map(item => item.jamTanggalPemusnahan);
      formData.append('jamTanggalPemusnahanList', JSON.stringify(jamList));
      formData.append('jamTanggalPemusnahan', firstItem.jamTanggalPemusnahan);

      // Handle paraf QC file (use from first item)
      if (firstItem.parafQCName && firstItem.parafQCName instanceof File) {
        formData.append('parafQC', firstItem.parafQCName);
      }
      // Handle paraf Manager file (use from first item)
      if (firstItem.parafManagerName && firstItem.parafManagerName instanceof File) {
        formData.append('parafManager', firstItem.parafManagerName);
      }
      // Handle multiple documentation files
      if (firstItem.dokumentasiFiles && firstItem.dokumentasiFiles.length > 0) {
        firstItem.dokumentasiFiles.forEach((file, index) => {
          formData.append(`dokumentasi_${index}`, file);
        });
        formData.append('dokumentasiCount', firstItem.dokumentasiFiles.length.toString());
      } else if (firstItem.dokumentasiFile) {
        formData.append('dokumentasi', firstItem.dokumentasiFile);
      }

      const response = await fetch('/api/submit-grouped', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Submission failed');
      }

      return response.json();
    }),
    onSuccess: useStableCallback(() => {
      setShowSuccessModal(true);
      setShowPdfButton(true);
      toast({
        title: "Berhasil!",
        description: `Data pemusnahan berhasil disimpan ke Google Spreadsheet.`,
      });
    }),
    onError: useStableCallback((error) => {
      const friendlyMessage = getUserFriendlyErrorMessage(error);
      toast({
        title: "Error",
        description: friendlyMessage,
        variant: "destructive",
      });
    }),
    onSettled: useStableCallback(() => {
      setIsSubmitting(false);
    }),
  });

  // Navigation helpers
  const nextStep = () => {
    const stepOrder: Step[] = ["date", "category", "products", "files", "review"];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      const nextStepValue = stepOrder[currentIndex + 1];
      setCurrentStep(nextStepValue);
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
    }
  };

  const prevStep = () => {
    const stepOrder: Step[] = ["date", "category", "products", "files", "review"];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  // Form helpers

  const resetForm = () => {
    setCustomProductName("");
    setEditingIndex(null);
    form.reset({
      tanggal: selectedDate,
      kategoriInduk: selectedCategory || "NOODLE",
      namaProduk: "",
      kodeProduk: "",
      jumlahProduk: 1,
      unit: "",
      metodePemusnahan: "",
      alasanPemusnahan: "",
      alasanPemusnahanManual: "",
      jamTanggalPemusnahan: formatWIBForInput(),
      parafQCName: "",
      parafManagerName: "",
      dokumentasiUrl: "",
      dokumentasiFile: undefined,
    });
  };

  const addItemToCurrentGroup = () => {
    if (!selectedCategory) return;

    const formData = form.getValues();
    const newItem: WasteItem = {
      ...formData,
      tanggal: selectedDate,
      kategoriInduk: selectedCategory,
    };

    setCategoryGroups(prev => {
      const existingGroup = prev.find(g => g.kategoriInduk === selectedCategory);
      if (existingGroup) {
        return prev.map(group => 
          group.kategoriInduk === selectedCategory
            ? { ...group, items: [...group.items, newItem] }
            : group
        );
      } else {
        return [...prev, { kategoriInduk: selectedCategory, items: [newItem] }];
      }
    });

    resetForm();
    toast({
      title: "Produk Ditambahkan",
      description: `Produk berhasil ditambahkan ke kategori ${selectedCategory}`,
    });
  };

  const addItemRow = () => {
    setItemRows(prev => [...prev, { ...emptyItemRow }]);
  };

  const removeItemRow = (index: number) => {
    setItemRows(prev => prev.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: keyof ItemRow, value: string | number) => {
    setItemRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const allItemRowsValid = itemRows.every(row =>
    row.namaProduk.trim() !== '' &&
    row.kodeProduk.trim() !== '' &&
    (typeof row.jumlahProduk === 'number' ? row.jumlahProduk > 0 : parseInt(row.jumlahProduk) > 0) &&
    row.unit.trim() !== '' &&
    row.metodePemusnahan.trim() !== ''
  );

  const addAllItemsToCurrentGroup = () => {
    if (!selectedCategory) return;
    const jamValue = form.getValues('jamTanggalPemusnahan');

    const newItems: WasteItem[] = itemRows.map(row => ({
      tanggal: selectedDate,
      kategoriInduk: selectedCategory,
      namaProduk: row.namaProduk,
      kodeProduk: row.kodeProduk,
      jumlahProduk: typeof row.jumlahProduk === 'string' ? parseInt(row.jumlahProduk) || 1 : row.jumlahProduk,
      unit: row.unit,
      metodePemusnahan: row.metodePemusnahan,
      alasanPemusnahan: row.alasanPemusnahan,
      alasanPemusnahanManual: row.alasanPemusnahanManual,
      jamTanggalPemusnahan: jamValue,
      parafQCName: '',
      parafManagerName: '',
      dokumentasiUrl: '',
      dokumentasiFile: undefined,
      dokumentasiFiles: undefined,
    }));

    setCategoryGroups(prev => {
      const existingGroup = prev.find(g => g.kategoriInduk === selectedCategory);
      if (existingGroup) {
        return prev.map(group =>
          group.kategoriInduk === selectedCategory
            ? { ...group, items: [...group.items, ...newItems] }
            : group
        );
      } else {
        return [...prev, { kategoriInduk: selectedCategory, items: newItems }];
      }
    });

    setItemRows([{ ...emptyItemRow }]);

    toast({
      title: "Produk Ditambahkan",
      description: `${newItems.length} produk berhasil ditambahkan ke kategori ${selectedCategory}`,
    });
  };

  const updateItemInCurrentGroup = () => {
    if (!selectedCategory || editingIndex === null) return;

    const formData = form.getValues();
    const updatedItem: WasteItem = {
      ...formData,
      tanggal: selectedDate,
      kategoriInduk: selectedCategory,
    };

    setCategoryGroups(prev => {
      return prev.map(group => 
        group.kategoriInduk === selectedCategory
          ? { 
              ...group, 
              items: group.items.map((item, index) => 
                index === editingIndex ? updatedItem : item
              )
            }
          : group
      );
    });

    resetForm();
    setEditingIndex(null);
    toast({
      title: "Produk Diperbarui",
      description: `Produk berhasil diperbarui`,
    });
  };

  const editItem = (index: number) => {
    if (!selectedCategory) return;
    
    const group = categoryGroups.find(g => g.kategoriInduk === selectedCategory);
    if (!group || !group.items[index]) return;

    const item = group.items[index];
    
    // Load item data into form
    form.reset({
      tanggal: item.tanggal,
      kategoriInduk: item.kategoriInduk,
      namaProduk: item.namaProduk,
      kodeProduk: item.kodeProduk,
      jumlahProduk: typeof item.jumlahProduk === 'number' ? item.jumlahProduk : parseInt(String(item.jumlahProduk), 10) || 1,
      unit: item.unit,
      metodePemusnahan: item.metodePemusnahan,
      alasanPemusnahan: item.alasanPemusnahan,
      alasanPemusnahanManual: item.alasanPemusnahanManual,
      jamTanggalPemusnahan: item.jamTanggalPemusnahan,
      parafQCName: item.parafQCName,
      parafManagerName: item.parafManagerName,
      dokumentasiUrl: item.dokumentasiUrl,
      dokumentasiFiles: item.dokumentasiFiles,
      dokumentasiFile: item.dokumentasiFile,
    });

    // Set custom product name if it was used
    if (selectedCategory && (selectedCategory === "DIMSUM" || selectedCategory === "PRODUKSI")) {
      const predefinedProducts = PREDEFINED_PRODUCTS[selectedCategory as keyof typeof PREDEFINED_PRODUCTS];
      if (!predefinedProducts.includes(item.namaProduk)) {
        setCustomProductName(item.namaProduk);
      }
    }

    setEditingIndex(index);
    
    // Scroll to form
    if (productFormRef.current) {
      productFormRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }

    toast({
      title: "Mode Edit",
      description: `Mengedit produk: ${item.namaProduk}`,
    });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    resetForm();
    toast({
      title: "Edit Dibatalkan",
      description: "Kembali ke mode tambah produk",
    });
  };

  const deleteItem = (index: number) => {
    if (!selectedCategory) return;

    setCategoryGroups(prev => {
      return prev.map(group => 
        group.kategoriInduk === selectedCategory
          ? { 
              ...group, 
              items: group.items.filter((_, i) => i !== index)
            }
          : group
      );
    });

    // If we're editing the item being deleted, cancel edit mode
    if (editingIndex === index) {
      setEditingIndex(null);
      resetForm();
    } else if (editingIndex !== null && editingIndex > index) {
      // Adjust editing index if needed
      setEditingIndex(editingIndex - 1);
    }

    toast({
      title: "Produk Dihapus",
      description: "Produk berhasil dihapus dari daftar",
    });
  };

  // Function to update files for all items in current category
  const updateCategoryFiles = (fileField: string, file: File | File[] | undefined) => {
    if (!selectedCategory) return;
    
    setCategoryGroups(prev => 
      prev.map(group => 
        group.kategoriInduk === selectedCategory
          ? {
              ...group,
              items: group.items.map(item => ({
                ...item,
                [fileField]: file
              }))
            }
          : group
      )
    );
  };

  // Check for duplicate submission
  const checkDuplicate = async () => {
    if (!selectedCategory) return false;
    setIsCheckingDuplicate(true);
    setDuplicateWarning(null);
    try {
      const res = await apiFetch(`/api/check-duplicate?date=${selectedDate}&shift=${selectedShift}&station=${selectedCategory}`);
      const data = await res.json();
      if (data.isDuplicate) {
        setDuplicateWarning(`Data untuk shift ${selectedShift} - station ${selectedCategory} pada tanggal ini sudah ada!`);
        return true;
      }
      return false;
    } catch {
      return false; // Don't block on error
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // Generate PDF for the day
  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const res = await apiFetch(`/api/get-day-data?date=${selectedDate}`);
      const dayData = await res.json();
      if (!dayData.success || !dayData.grouped) {
        toast({ title: "Ups!", description: "Gagal ambil data dari spreadsheet", variant: "destructive" });
        return;
      }
      // Dynamic import jspdf
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      // Try to load logo
      let logoImg: string | null = null;
      try {
        const logoRes = await fetch('/logo-ppa.png');
        if (logoRes.ok) {
          const blob = await logoRes.blob();
          logoImg = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch {}

      // Header
      if (logoImg) {
        doc.addImage(logoImg, 'PNG', margin, 7, 18, 18);
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PT. PESTA PORA ABADI', pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(12);
      doc.text('FORM PEMUSNAHAN PRODUK', pageWidth / 2, 19, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Dok.No. PPA/FORM/OPS-STORE/016', pageWidth - margin, 10, { align: 'right' });

      // Info line
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = days[dateObj.getDay()];
      const dateDisplay = `${dateObj.getDate().toString().padStart(2,'0')}/${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${dateObj.getFullYear()}`;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const infoY = 28;
      doc.text(`Hari: ${dayName}`, margin, infoY);
      doc.text(`Tanggal: ${dateDisplay}`, margin + 50, infoY);
      doc.text(`Store: ${dayData.storeName || storeName}`, margin + 110, infoY);

      // Table for each shift
      const shifts = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'];
      const stationOrder = ['NOODLE', 'PRODUKSI', 'BAR', 'DIMSUM'];
      let startY = 33;

      for (let shiftIdx = 0; shiftIdx < shifts.length; shiftIdx++) {
        const shift = shifts[shiftIdx];
        const shiftData = dayData.grouped[shift] || [];
        
        // Section header
        doc.setFillColor(200, 200, 200);
        doc.rect(margin, startY, pageWidth - 2 * margin, 6, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`WASTE ${shift}`, margin + 2, startY + 4);
        startY += 7;


    // Helper: parse jam value from various formats to "HH:MM WIB"
    const parseJamValue = (raw: string): string => {
      if (!raw || raw === '-') return '-';
      // Already formatted with WIB
      if (raw.includes('WIB')) return raw;
      // Handle multi-line values (newline separated)
      if (raw.includes('\n')) {
        return raw.split('\n').map(line => parseJamValue(line.trim())).join('\n');
      }
      // Excel serial date number (like 46039.57261666666)
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 40000) {
        const timeFraction = num % 1;
        const totalMinutes = Math.round(timeFraction * 24 * 60);
        const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const minutes = (totalMinutes % 60).toString().padStart(2, '0');
        return `${hours}:${minutes} WIB`;
      }
      // datetime-local format "2026-03-08T23:28"
      const dtMatch = raw.match(/T(\d{2}:\d{2})/);
      if (dtMatch) return `${dtMatch[1]} WIB`;
      // Just time "23:28" or "23:28:00"
      const timeMatch = raw.match(/^(\d{2}:\d{2})/);
      if (timeMatch) return `${timeMatch[1]} WIB`;
      return raw;
    };

        // Table headers
        const headers = [['NO', 'NAMA PRODUK', 'KODE PRODUK', 'JUMLAH', 'METODE', 'ALASAN', 'JAM', 'QC', 'MANAJER', 'DOKUMENTASI']];
        
        // Helper: extract URL from =IMAGE("url"; ...) or =IMAGE("url", ...) formula
        const extractImageUrl = (val: string): string => {
          if (!val) return '';
          const match = val.match(/=IMAGE\(["']([^"']+)["']/i);
          return match ? match[1] : (val.startsWith('http') ? val : '');
        };

        // Fetch signature image via server proxy to avoid CORS issues
        const sigCache: Record<string, string> = {};
        const fetchSigImage = async (url: string): Promise<string | null> => {
          if (!url || url === '-' || !url.startsWith('http')) return null;
          if (sigCache[url]) return sigCache[url];
          try {
            const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
            if (!proxyRes.ok) return null;
            const data = await proxyRes.json();
            if (data.success && data.dataUrl) {
              sigCache[url] = data.dataUrl;
              return data.dataUrl;
            }
            return null;
          } catch { return null; }
        };

        // Pre-fetch all signatures for this shift
        for (const station of stationOrder) {
          const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
          if (entry) {
            const qcUrl = extractImageUrl(entry.parafQC);
            const mgrUrl = extractImageUrl(entry.parafManager);
            if (qcUrl) await fetchSigImage(qcUrl);
            if (mgrUrl) await fetchSigImage(mgrUrl);
          }
        }

        // Build rows - 1 row per station, items joined with newline in cells
        type RowEntry = { entry: any | null; stationIdx: number };
        const rowEntries: RowEntry[] = [];
        const rows: string[][] = [];

        stationOrder.forEach((station, idx) => {
          const entry = shiftData.find((e: any) => e.station?.toUpperCase() === station);
          if (entry) {
            // Keep multi-line items in one cell per station
            const namaProduk = String(entry.namaProduk || '-').replace(/,\s*/g, '\n');
            const kodeProduk = String(entry.kodeProduk || '-').replace(/,\s*/g, '\n');
            const jumlahProduk = String(entry.jumlahProduk || '-').replace(/,\s*/g, '\n');
            const metode = String(entry.metodePemusnahan || '-').replace(/,\s*/g, '\n');
            const alasan = String(entry.alasanPemusnahan || '-').replace(/,\s*/g, '\n');
            
            // Check if dokumentasi has actual content
            const hasDocs = entry.dokumentasi?.some((d: string) => {
              if (!d || d === '-') return false;
              return d.includes('http') || d.includes('IMAGE');
            });

            rowEntries.push({ entry, stationIdx: idx });
            rows.push([
              (idx + 1).toString(),
              namaProduk,
              kodeProduk,
              jumlahProduk,
              metode,
              alasan,
              parseJamValue(entry.jamTanggalPemusnahan || '-'),
              '', // QC - drawn as image in didDrawCell
              '', // Manajer - drawn as image in didDrawCell
              hasDocs ? '' : '-', // Dokumentasi - drawn as link in didDrawCell
            ]);
          } else {
            rowEntries.push({ entry: null, stationIdx: idx });
            rows.push([(idx + 1).toString(), '-', '-', '-', '-', '-', '-', '-', '-', '-']);
          }
        });

        const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/12W36gW1ma3Df2-zftIYkX-z6c0m_X1KV8C1ISDw8PtI/edit';

        autoTable(doc, {
          head: headers,
          body: rows,
          startY: startY,
          margin: { left: margin, right: margin },
          styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.1, minCellHeight: 8, valign: 'middle' },
          headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle' },
          columnStyles: {
            0: { cellWidth: 9, halign: 'center', valign: 'middle' },
            1: { cellWidth: 45 },
            2: { cellWidth: 28 },
            3: { cellWidth: 16, halign: 'center' },
            4: { cellWidth: 25 },
            5: { cellWidth: 35 },
            6: { cellWidth: 35 },
            7: { cellWidth: 25, halign: 'center' },
            8: { cellWidth: 28, halign: 'center' },
            9: { cellWidth: 31, halign: 'center' },
          },
          tableWidth: 'wrap',
          theme: 'grid',
          didDrawCell: (data: any) => {
            if (data.section !== 'body') return;
            const rowIdx = data.row.index;
            const colIdx = data.column.index;
            const rowEntry = rowEntries[rowIdx];
            if (!rowEntry?.entry) return;

            const cellX = data.cell.x;
            const cellY = data.cell.y;
            const cellW = data.cell.width;
            const cellH = data.cell.height;

            // QC signature (col 7)
            if (colIdx === 7) {
              const qcUrl = extractImageUrl(rowEntry.entry.parafQC);
              if (qcUrl && sigCache[qcUrl]) {
                try {
                  const imgH = Math.min(cellH - 2, 14);
                  const imgW = Math.min(cellW - 2, imgH * 2);
                  const imgX = cellX + (cellW - imgW) / 2;
                  const imgY = cellY + (cellH - imgH) / 2;
                  doc.addImage(sigCache[qcUrl], 'PNG', imgX, imgY, imgW, imgH);
                } catch {}
              }
            }

            // Manajer signature (col 8)
            if (colIdx === 8) {
              const mgrUrl = extractImageUrl(rowEntry.entry.parafManager);
              if (mgrUrl && sigCache[mgrUrl]) {
                try {
                  const imgH = Math.min(cellH - 2, 14);
                  const imgW = Math.min(cellW - 2, imgH * 2);
                  const imgX = cellX + (cellW - imgW) / 2;
                  const imgY = cellY + (cellH - imgH) / 2;
                  doc.addImage(sigCache[mgrUrl], 'PNG', imgX, imgY, imgW, imgH);
                } catch {}
              }
            }

            // Dokumentasi link (col 9)
            if (colIdx === 9) {
              const hasDocs = rowEntry.entry.dokumentasi?.some((d: string) => {
                if (!d || d === '-') return false;
                return d.includes('http') || d.includes('IMAGE');
              });
              if (hasDocs) {
                doc.setTextColor(0, 0, 255);
                doc.setFontSize(7);
                const linkText = 'Lihat Foto';
                const textWidth = doc.getTextWidth(linkText);
                const linkX = cellX + (cellW - textWidth) / 2;
                const linkY = cellY + cellH / 2 + 1;
                doc.text(linkText, linkX, linkY);
                // Underline
                doc.setDrawColor(0, 0, 255);
                doc.setLineWidth(0.2);
                doc.line(linkX, linkY + 0.5, linkX + textWidth, linkY + 0.5);
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.1);
                // Clickable area over the text
                doc.link(linkX, linkY - 3, textWidth, 5, { url: spreadsheetUrl });
                doc.setTextColor(0, 0, 0);
              }
            }
          },
        });

        startY = (doc as any).lastAutoTable.finalY + 3;
        
        // Check if we need a new page
        if (startY > pageHeight - 30 && shiftIdx < shifts.length - 1) {
          doc.addPage();
          startY = 15;
        }
      }

      // Footer - ensure enough space
      if (startY > pageHeight - 45) {
        doc.addPage();
        startY = 15;
      }
      startY = startY + 8;

      // Get logged-in QC name from localStorage
      const loggedInQC = localStorage.getItem('waste_app_qc_name') || 'QC';

      // Fetch QC signature from API (dynamic per tenant)
      let qcSigImg: string | null = null;
      try {
        const tenantId = localStorage.getItem("waste_app_tenant_id") || "";
        const sigRes = await fetch(`/api/signatures?tenant_id=${tenantId}&name=${encodeURIComponent(loggedInQC)}`);
        const sigData = await sigRes.json();
        if (sigData.success && sigData.url) {
          const imgRes = await fetch(sigData.url);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            qcSigImg = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
        }
      } catch {}

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      // Left: Diketahui Oleh
      doc.text('Diketahui Oleh :', margin, startY);
      doc.line(margin, startY + 15, margin + 50, startY + 15);
      doc.setFont('helvetica', 'normal');
      doc.text('AM/RM', margin + 12, startY + 20);
      doc.setFont('helvetica', 'bold');

      // Right: Dilaporkan oleh
      const rightX = pageWidth - margin - 60;
      doc.text('Dilaporkan oleh : QC', rightX, startY);
      if (qcSigImg) {
        doc.addImage(qcSigImg, 'JPEG', rightX + 10, startY + 2, 30, 10);
      }
      doc.line(rightX, startY + 15, rightX + 55, startY + 15);
      doc.setFont('helvetica', 'normal');
      doc.text(loggedInQC, rightX + 5, startY + 20);
      doc.setFont('helvetica', 'bold');

      // Save locally
      const fileName = `BA_WASTE_${selectedDate.replace(/-/g, '')}.pdf`;
      doc.save(fileName);
      
      toast({ title: "PDF Jadi!", description: `File ${fileName} berhasil ke-download` });


    } catch (error) {
      console.error('PDF generation error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      toast({ title: "Gagal Bikin PDF", description: `${errMsg}`, variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const submitCurrentGroup = () => {
    if (!selectedCategory) return;
    
    const group = categoryGroups.find(g => g.kategoriInduk === selectedCategory);
    if (!group || group.items.length === 0) {
      toast({
        title: "Error",
        description: "Tidak ada produk dalam kategori ini",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    // Check for duplicates first
    checkDuplicate().then((isDup) => {
      if (isDup) {
        setIsSubmitting(false);
        toast({
          title: "⚠️ Data Duplikat",
          description: `Shift ${selectedShift} - Station ${selectedCategory} sudah pernah disubmit untuk tanggal ini!`,
          variant: "destructive",
        });
        return;
      }
      submitMutation.mutate(group);
    });
  };

  const currentGroup = selectedCategory ? categoryGroups.find(g => g.kategoriInduk === selectedCategory) : null;
  
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case "date":
        return selectedDate !== "" && selectedDate.trim() !== "";
      case "category":
        return selectedCategory !== null;
      case "products":
        return currentGroup && currentGroup.items.length > 0 && currentGroup.items.every(item => 
          item.namaProduk && item.kodeProduk && item.jumlahProduk && item.unit && item.metodePemusnahan
        );
      case "files": {
        const docs = form.watch("dokumentasiFiles");
        return docs && docs.length > 0; // Foto dokumentasi wajib
      }
      case "review":
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-cyber-dark cyber-grid-bg flex flex-col">
      {/* Header - Cyberpunk */}
      <div className="sticky top-0 z-50 border-b border-cyan-900/30 bg-[hsl(220,45%,8%)]/95 backdrop-blur-md">
        <div className="w-full px-4 py-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => window.location.href = "/"}
                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                title="Balik ke Menu"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-shrink-0 relative">
                <img 
                  src={wasteLogo} 
                  alt="WASTE Logo" 
                  className="h-8 w-auto sm:h-9 rounded-lg cyber-border"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-base font-heading font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent truncate tracking-wider leading-tight">
                  BA WASTE
                </h1>
                {tenantName && <p className="text-[10px] text-cyan-500/70 font-mono truncate">{tenantName}</p>}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <button
                onClick={() => window.location.href = "/dashboard"}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/50 rounded-md transition-all"
              >
                <BarChart3 className="w-3 h-3" />
                Dashboard
              </button>
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-3 sm:px-4 py-3 sm:py-4">
        {/* Step Wizard */}
        <StepWizard 
          steps={STEPS} 
          currentStep={currentStep} 
          completedSteps={completedSteps}
          className="mb-4 sm:mb-6"
        />

        {/* Step Content - Improved responsive design */}
        <div className="form-step animate-slide-in">
          <div className="p-4 sm:p-6">{/* Consistent padding across screen sizes */}
            
            {/* Step 1: Date Selection */}
            {currentStep === "date" && (
              <div className="space-y-3 sm:space-y-4">
                <div className="text-center">
                  <Calendar className="w-6 h-6 text-cyan-400 inline-block mr-2 align-middle" />
                  <h2 className="text-lg sm:text-xl font-heading font-bold mb-1 inline align-middle">Pilih Tanggal Hari Kerja</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Pilih tanggal pencatatan pemusnahan</p>
                </div>
                
                <div className="w-full space-y-4 sm:space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="date-input" className="text-base sm:text-lg font-medium">Tanggal Hari Kerja</Label>
                    <Input
                      id="date-input"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="text-base sm:text-lg h-12 sm:h-14 text-center"
                      max={getCurrentWIBDateString()}
                      required
                    />
                  </div>
                  
                  {selectedDate && (
                    <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-lg p-3 sm:p-4">
                      <p className="text-sm sm:text-base text-cyan-300 text-center">
                        <strong>Tanggal terpilih:</strong><br className="sm:hidden" />
                        <span className="sm:ml-2">{formatWIBIndonesian(selectedDate)}</span>
                      </p>
                    </div>
                  )}
                  
                  {/* Shift Selector */}
                  <div className="space-y-3">
                    <Label className="text-base sm:text-lg font-medium">Shift</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {SHIFTS.map((shift) => (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => setSelectedShift(shift.id)}
                          className={`p-3 rounded-lg border-2 text-center font-semibold transition-all ${
                            selectedShift === shift.id
                              ? shift.active
                              : shift.inactive
                          }`}
                        >
                          {shift.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resto Selector */}
                  <div className="space-y-3">
                    <Label className="text-base sm:text-lg font-medium">Resto / Outlet</Label>
                    <div className="flex h-12 sm:h-14 w-full items-center rounded-md border border-input bg-background/50 px-3 py-2 text-base font-medium">
                      {storeName || 'Loading...'}
                    </div>
                  </div>

                  {/* Button Selanjutnya - di atas status */}
                  {selectedDate && selectedShift && storeName && (
                    <div className="flex justify-center">
                      <Button
                        onClick={nextStep}
                        className="flex items-center justify-center gap-2 min-h-[48px] px-8 text-base sm:text-sm bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-medium transition-all duration-200 w-full sm:w-auto"
                      >
                        Selanjutnya
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Status Shift & Station yang sudah input */}
                  {selectedDate && (
                    <div className="bg-slate-900/50 border border-cyan-800/30 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-sm font-semibold text-cyan-300">Status Input Tanggal Ini</h4>
                        {isLoadingStatus && (
                          <div className="w-3 h-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                        )}
                      </div>
                      {Object.keys(shiftStationStatus).length === 0 && !isLoadingStatus ? (
                        <p className="text-xs text-muted-foreground">Belum ada data yang diinput untuk tanggal ini.</p>
                      ) : (
                        <div className="space-y-2">
                          {SHIFTS.map((shift) => {
                            const stations = shiftStationStatus[shift.id] || [];
                            const allStations = ['NOODLE', 'DIMSUM', 'BAR', 'PRODUKSI'];
                            return (
                              <div key={shift.id} className="flex items-start gap-2">
                                <span className={`text-xs font-bold min-w-[70px] px-2 py-0.5 rounded ${stations.length > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-slate-800/50 text-slate-500'}`}>
                                  {shift.label}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {allStations.map(st => {
                                    const done = stations.includes(st);
                                    return (
                                      <span key={st} className={`text-[10px] px-1.5 py-0.5 rounded ${done ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40' : 'bg-slate-800/30 text-slate-600 border border-slate-700/30'}`}>
                                        {done ? '✅' : '⬜'} {st}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {Object.keys(shiftStationStatus).length > 0 && (
                            <p className="text-[10px] text-emerald-400/70 mt-2 pt-2 border-t border-slate-700/30">
                              ✅ = Sudah diinput | ⬜ = Belum diinput — Lengkapi semua untuk generate PDF
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Category Selection */}
            {currentStep === "category" && (
              <div className="space-y-3 sm:space-y-4">
                <div className="text-center">
                  <FileText className="w-6 h-6 text-cyan-400 inline-block mr-2 align-middle" />
                  <h2 className="text-lg sm:text-xl font-heading font-bold mb-1 inline align-middle">Pilih Station</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Pilih station yang akan dimusnahkan</p>
                </div>
                
                <CategorySelector 
                  selectedCategory={selectedCategory}
                  onSelect={(category) => {
                    setSelectedCategory(category);
                    setCustomProductName("");
                    if (selectedCategory !== category) {
                      form.setValue("kategoriInduk", category);
                      form.setValue("namaProduk", "");
                    }
                  }}
                  className="w-full"
                />
              </div>
            )}

            {/* Step 3: Product Details */}
            {currentStep === "products" && selectedCategory && (
              <div className="space-y-3 sm:space-y-4">
                <div className="text-center">
                  <Upload className="w-6 h-6 text-cyan-400 inline-block mr-2 align-middle" />
                  <h2 className="text-lg sm:text-xl font-heading font-bold mb-1 inline align-middle">
                    {editingIndex !== null ? `Edit Produk - ${selectedCategory}` : `Detail Produk - ${selectedCategory}`}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {editingIndex !== null ? 'Edit detail produk yang akan dimusnahkan' : 'Masukkan detail produk yang akan dimusnahkan'}
                  </p>
                </div>

                {/* Edit mode: single item form using react-hook-form */}
                {editingIndex !== null ? (
                  <Form {...form}>
                    <form ref={productFormRef} className="space-y-6 w-full">
                      <div className="bg-cyan-950/20 border border-cyan-700/30 rounded-lg p-3 text-center text-sm text-cyan-300 font-medium">
                        ✏️ Mode Edit — Mengedit item yang sudah ditambahkan
                      </div>
                      <div className="space-y-4 md:space-y-6">
                        <FormField
                          control={form.control}
                          name="namaProduk"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nama Produk</FormLabel>
                              {selectedCategory && (selectedCategory === "DIMSUM" || selectedCategory === "PRODUKSI") ? (
                                <div className="space-y-3">
                                  <Select onValueChange={(value) => { field.onChange(value); setCustomProductName(""); }} value={field.value && !customProductName ? field.value : ""}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {PREDEFINED_PRODUCTS[selectedCategory as keyof typeof PREDEFINED_PRODUCTS].map((product) => (
                                        <SelectItem key={product} value={product}>{product}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input placeholder="Atau masukkan nama produk lain (optional)" className="text-base" value={customProductName} onChange={(e) => { setCustomProductName(e.target.value); field.onChange(e.target.value); }} />
                                </div>
                              ) : (
                                <FormControl><Input placeholder="Contoh: Nama Produk" className="text-base" {...field} /></FormControl>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField control={form.control} name="kodeProduk" render={({ field }) => (<FormItem><FormLabel>Kode Lot/Exp</FormLabel><FormControl><Input type={field.value ? "date" : "text"} placeholder="Kode Lot" onFocus={(e: React.FocusEvent<HTMLInputElement>) => { e.target.type = "date"; }} onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (!e.target.value) e.target.type = "text"; }} className="text-base min-h-[44px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="jumlahProduk" render={({ field }) => (<FormItem><FormLabel>Jumlah Produk</FormLabel><FormControl><Input type="number" min={1} placeholder="0" className="text-base min-h-[44px]" {...field} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Pilih unit" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PCS">PCS</SelectItem><SelectItem value="PORSI">PORSI</SelectItem><SelectItem value="PACK">PACK</SelectItem><SelectItem value="GRAM">GRAM</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="metodePemusnahan" render={({ field }) => (<FormItem><FormLabel>Metode Pemusnahan</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Pilih metode" /></SelectTrigger></FormControl><SelectContent><SelectItem value="DI BUANG">DI BUANG</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                      <div className="space-y-4">
                        <FormField control={form.control} name="alasanPemusnahan" render={({ field }) => (<FormItem><FormLabel>Alasan Pemusnahan</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Pilih alasan pemusnahan" /></SelectTrigger></FormControl><SelectContent><SelectItem value="HANDLING">HANDLING</SelectItem><SelectItem value="KUALITAS EKSTERNAL">KUALITAS EKSTERNAL</SelectItem><SelectItem value="SUSUT">SUSUT</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="alasanPemusnahanManual" render={({ field }) => (<FormItem><FormLabel>Alasan Lainnya (Optional)</FormLabel><FormControl><Input placeholder="Tulis alasan lainnya jika diperlukan" className="text-base min-h-[44px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="jamTanggalPemusnahan" render={({ field }) => (<FormItem><FormLabel>Jam & Tanggal Pemusnahan</FormLabel><FormControl><Input type="datetime-local" className="text-base min-h-[44px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button type="button" onClick={updateItemInCurrentGroup} className="flex-1 min-h-[48px] text-base sm:text-sm bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-medium transition-all duration-200" disabled={!form.watch("namaProduk") || !form.watch("kodeProduk") || !form.watch("jumlahProduk") || !form.watch("unit") || !form.watch("metodePemusnahan")}>
                          <Save className="w-4 h-4 mr-2" />Update Produk
                        </Button>
                        <Button type="button" onClick={cancelEdit} variant="outline" className="min-h-[48px] text-base sm:text-sm">
                          <X className="w-4 h-4 mr-2" />Batal
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  /* Multi-item add mode - compact layout */
                  <div ref={productFormRef} className="space-y-3 w-full">
                    {itemRows.map((row, rowIndex) => (
                      <div key={rowIndex} className="border border-cyan-900/30 rounded-md p-3 space-y-2 bg-slate-900/40 relative">
                        {/* Row header */}
                        <div className="mb-1">
                          <span className="text-xs font-semibold text-muted-foreground">Input Produk</span>
                        </div>

                        {/* Nama Produk */}
                        {selectedCategory && (selectedCategory === "DIMSUM" || selectedCategory === "PRODUKSI") ? (
                          <div className="space-y-1.5">
                            <Select
                              onValueChange={(value) => { updateItemRow(rowIndex, 'namaProduk', value); updateItemRow(rowIndex, 'customProductName', ''); }}
                              value={row.namaProduk && !row.customProductName ? row.namaProduk : ""}
                            >
                              <SelectTrigger className="h-10"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                              <SelectContent>
                                {PREDEFINED_PRODUCTS[selectedCategory as keyof typeof PREDEFINED_PRODUCTS].map((product) => (
                                  <SelectItem key={product} value={product}>{product}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Atau ketik nama produk lainnya"
                              className="h-10 text-sm"
                              value={row.customProductName}
                              onChange={(e) => { updateItemRow(rowIndex, 'customProductName', e.target.value); updateItemRow(rowIndex, 'namaProduk', e.target.value); }}
                            />
                          </div>
                        ) : (
                          <Input
                            placeholder={
                              selectedCategory === "NOODLE" ? "Nama produk (cth: PANGSIT GORENG)" :
                              selectedCategory === "BAR" ? "Nama produk (cth: APEL, PEER)" :
                              "Nama produk"
                            }
                            className="h-10 text-sm"
                            value={row.namaProduk}
                            onChange={(e) => updateItemRow(rowIndex, 'namaProduk', e.target.value)}
                          />
                        )}

                        {/* Kode + Jumlah + Unit in one row */}
                        <div className="grid grid-cols-[1fr_0.6fr_0.6fr] gap-2">
                          <Input type={row.kodeProduk ? "date" : "text"} placeholder="Kode Lot" onFocus={(e: React.FocusEvent<HTMLInputElement>) => { e.target.type = "date"; }} onBlur={(e: React.FocusEvent<HTMLInputElement>) => { if (!e.target.value) e.target.type = "text"; }} className="h-10 text-sm" value={row.kodeProduk} onChange={(e) => updateItemRow(rowIndex, 'kodeProduk', e.target.value)} />
                          <Input type="number" min={1} placeholder="Jml" className="h-10 text-sm" value={row.jumlahProduk} onChange={(e) => updateItemRow(rowIndex, 'jumlahProduk', e.target.value)} />
                          <Select onValueChange={(value) => updateItemRow(rowIndex, 'unit', value)} value={row.unit}>
                            <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Unit" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PCS">PCS</SelectItem>
                              <SelectItem value="PORSI">PORSI</SelectItem>
                              <SelectItem value="PACK">PACK</SelectItem>
                              <SelectItem value="GRAM">GRAM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Metode + Alasan in one row */}
                        <div className="grid grid-cols-2 gap-2">
                          <Select onValueChange={(value) => updateItemRow(rowIndex, 'metodePemusnahan', value)} value={row.metodePemusnahan}>
                            <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Metode" /></SelectTrigger>
                            <SelectContent><SelectItem value="DI BUANG">DI BUANG</SelectItem></SelectContent>
                          </Select>
                          <Select onValueChange={(value) => updateItemRow(rowIndex, 'alasanPemusnahan', value)} value={row.alasanPemusnahan}>
                            <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Alasan" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HANDLING">HANDLING</SelectItem>
                              <SelectItem value="KUALITAS EKSTERNAL">KUALITAS EKSTERNAL</SelectItem>
                              <SelectItem value="SUSUT">SUSUT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Alasan Lainnya - only show if needed */}
                        <Input placeholder="Alasan lainnya (opsional)" className="h-10 text-sm" value={row.alasanPemusnahanManual} onChange={(e) => updateItemRow(rowIndex, 'alasanPemusnahanManual', e.target.value)} />
                      </div>
                    ))}

                    {/* Add Item button - adds current item to queue and resets form */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const row = itemRows[0];
                        if (!row || !row.namaProduk.trim() || !row.kodeProduk.trim() || !(typeof row.jumlahProduk === 'number' ? row.jumlahProduk > 0 : parseInt(String(row.jumlahProduk)) > 0) || !row.unit.trim() || !row.metodePemusnahan.trim()) {
                          toast({ title: "\u26a0\ufe0f Data Belum Lengkap", description: "Lengkapi semua field sebelum menambahkan item", variant: "destructive" });
                          return;
                        }
                        if (!selectedCategory) return;
                        const jamValue = form.getValues('jamTanggalPemusnahan');
                        const newItem: WasteItem = {
                          tanggal: selectedDate,
                          kategoriInduk: selectedCategory,
                          namaProduk: row.namaProduk,
                          kodeProduk: row.kodeProduk,
                          jumlahProduk: typeof row.jumlahProduk === 'string' ? parseInt(row.jumlahProduk) || 1 : row.jumlahProduk,
                          unit: row.unit,
                          metodePemusnahan: row.metodePemusnahan,
                          alasanPemusnahan: row.alasanPemusnahan,
                          alasanPemusnahanManual: row.alasanPemusnahanManual,
                          jamTanggalPemusnahan: jamValue,
                          parafQCName: '',
                          parafManagerName: '',
                          dokumentasiUrl: '',
                          dokumentasiFile: undefined,
                          dokumentasiFiles: undefined,
                        };
                        setCategoryGroups(prev => {
                          const existingGroup = prev.find(g => g.kategoriInduk === selectedCategory);
                          if (existingGroup) {
                            return prev.map(group =>
                              group.kategoriInduk === selectedCategory
                                ? { ...group, items: [...group.items, newItem] }
                                : group
                            );
                          } else {
                            return [...prev, { kategoriInduk: selectedCategory, items: [newItem] }];
                          }
                        });
                        setItemRows([{ ...emptyItemRow }]);
                        toast({
                          title: "\u2705 Produk Ditambahkan",
                          description: `${row.namaProduk} masuk ke antrian ${selectedCategory}`,
                        });
                      }}
                      className="w-full h-10 border-dashed border-2 border-green-400 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 text-sm font-medium"
                      disabled={!itemRows[0] || !itemRows[0].namaProduk.trim() || !itemRows[0].kodeProduk.trim() || !(typeof itemRows[0].jumlahProduk === 'number' ? itemRows[0].jumlahProduk > 0 : parseInt(String(itemRows[0].jumlahProduk)) > 0) || !itemRows[0].unit.trim() || !itemRows[0].metodePemusnahan.trim()}
                    >
                      + Tambah Item
                    </Button>

                    {/* Shared Jam Pemusnahan */}
                    <Form {...form}>
                      <FormField
                        control={form.control}
                        name="jamTanggalPemusnahan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Jam Pemusnahan (semua item)</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" className="h-10 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </Form>


                  </div>
                )}

                {/* Product List */}
                {currentGroup && currentGroup.items.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">
                      Produk Ditambahkan ({currentGroup.items.length})
                    </h3>
                    <div className="space-y-3">
                      {currentGroup.items.map((item, index) => (
                        <div key={index} className={`bg-muted/50 rounded-lg p-4 border transition-colors ${editingIndex === index ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{item.namaProduk}</h4>
                                {editingIndex === index && (
                                  <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full font-medium">
                                    Sedang Diedit
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {item.kodeProduk} • {item.jumlahProduk} {item.unit} • {item.metodePemusnahan}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.alasanPemusnahan && item.alasanPemusnahanManual 
                                  ? `${item.alasanPemusnahan} - ${item.alasanPemusnahanManual}`
                                  : item.alasanPemusnahan || item.alasanPemusnahanManual || 'Tidak ada alasan'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => editItem(index)}
                                className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950"
                                disabled={editingIndex !== null && editingIndex !== index}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => deleteItem(index)}
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300 text-red-600 hover:text-red-700 dark:hover:bg-red-950 dark:text-red-400 dark:hover:text-red-300"
                                disabled={editingIndex !== null}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: File Upload */}
            {currentStep === "files" && selectedCategory && (
              <div className="space-y-4 sm:space-y-6">
                <div className="text-center px-2 sm:px-0">
                  <Upload className="w-6 h-6 text-cyan-400 inline-block mr-2 align-middle" />
                  <h2 className="text-xl sm:text-2xl font-bold mb-2">Upload Dokumen</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Upload paraf dan dokumentasi (opsional)</p>
                </div>

                <div className="w-full space-y-4 sm:space-y-6">
                  <ParafSelector
                    label="Paraf QC"
                    description="Pilih nama buat paraf QC"
                    value={form.watch("parafQCName")}
                    onValueChange={(value) => {
                      form.setValue("parafQCName", value);
                      updateCategoryFiles('parafQCName', value);
                    }}
                  />

                  <ParafManagerSelector
                    label="Paraf Manager"
                    description="Pilih nama buat paraf Manager"
                    value={form.watch("parafManagerName")}
                    onValueChange={(value) => {
                      form.setValue("parafManagerName", value);
                      updateCategoryFiles('parafManagerName', value);
                    }}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Dokumentasi <span className="text-red-400">*wajib</span></label>
                    <p className="text-xs text-muted-foreground">Upload minimal 1 foto dokumentasi pemusnahan (maks 10 file)</p>
                    <MultiFileUpload
                      files={form.watch("dokumentasiFiles") || []}
                      onFilesSelect={(files) => {
                        form.setValue("dokumentasiFiles", files);
                        updateCategoryFiles('dokumentasiFiles', files);
                      }}
                      maxFiles={10}
                      label="Upload Dokumentasi"
                    />
                    {(!form.watch("dokumentasiFiles") || form.watch("dokumentasiFiles")?.length === 0) ? (
                      <p className="text-xs text-red-400 flex items-center gap-1 mt-1">⚠️ Minimal 1 foto dokumentasi harus diupload untuk lanjut</p>
                    ) : (
                      <p className="text-xs text-green-400 flex items-center gap-1 mt-1">✅ {form.watch("dokumentasiFiles")?.length} foto siap</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === "review" && selectedCategory && currentGroup && (
              <div className="space-y-3 sm:space-y-4">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-emerald-400 mb-3 sm:mb-4" />
                  <h2 className="text-lg sm:text-xl font-bold mb-1 inline align-middle">Review Data</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Periksa kembali data sebelum mengirim</p>
                </div>

                <div className="w-full space-y-3 sm:space-y-4">
                  <div className="bg-slate-900/50 rounded-lg p-3 sm:p-4 border border-cyan-900/30">{/* Review summary */}
                    <h3 className="text-lg font-semibold mb-4 text-cyan-300">Ringkasan Pengiriman</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Tanggal:</span>
                        <p className="font-medium">{formatWIBForDisplay(selectedDate)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shift:</span>
                        <p className="font-medium">{selectedShift}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resto:</span>
                        <p className="font-medium">{storeName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Kategori:</span>
                        <p className="font-medium">{selectedCategory}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Produk:</span>
                        <p className="font-medium">{currentGroup.items.length} item</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <p className="font-medium text-success">Siap dikirim</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-950/20 border border-amber-700/30 rounded-lg p-3 sm:p-4">{/* Warning box */}
                    <h4 className="font-semibold text-amber-400 mb-2">
                      ⚠️ Konfirmasi Pengiriman
                    </h4>
                    <p className="text-sm text-amber-300/80">
                      Data akan langsung dikirim ke Google Spreadsheet dan tidak dapat dibatalkan. 
                      Pastikan semua informasi sudah benar.
                    </p>
                  </div>

                  <Button
                    onClick={submitCurrentGroup}
                    disabled={isSubmitting}
                    className="w-full h-12 sm:h-14 text-base sm:text-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-semibold shadow-lg shadow-cyan-500/10 transition-all duration-200"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent mr-2 sm:mr-3" />
                        <span className="hidden sm:inline">Mengirim ke Google Spreadsheet...</span>
                        <span className="sm:hidden">Mengirim...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />
                        <span className="hidden sm:inline">Kirim Data ke Google Spreadsheet</span>
                        <span className="sm:hidden">Kirim Data</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-6 pt-4 border-t border-border">
              {/* Previous Button */}
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === "date"}
                className="flex items-center justify-center gap-2 min-h-[48px] text-base sm:text-sm order-2 sm:order-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Sebelumnya
              </Button>

              {/* Next Button */}
              <div className="flex justify-center order-1 sm:order-2">
                {currentStep !== "review" && (
                  <Button
                    onClick={nextStep}
                    disabled={!canProceedToNextStep()}
                    className="flex items-center justify-center gap-2 min-h-[48px] px-8 text-base sm:text-sm bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-medium transition-all duration-200"
                  >
                    Selanjutnya
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Reset Button - Moved to bottom */}
            <div className="mt-4 pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  const hasData = categoryGroups.some(g => g.items.length > 0) ||
                    itemRows.some(r => r.namaProduk.trim() !== '');
                  if (hasData) {
                    setShowResetConfirm(true);
                  } else {
                    setCurrentStep("date");
                    setCompletedSteps([]);
                    setSelectedCategory(null);
                    setCategoryGroups([]);
                    setEditingIndex(null);
                    resetForm();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] text-base sm:text-sm bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-800/40 hover:border-red-700/60 transition-all duration-200"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-sm sm:max-w-md mx-4">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-emerald-950/40 border border-emerald-500/30 rounded-full flex items-center justify-center mb-3 sm:mb-4" style={{boxShadow: '0 0 20px rgba(16,185,129,0.2)'}}>
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
            </div>
            <DialogTitle className="text-center text-lg sm:text-xl">Data Berhasil Dikirim!</DialogTitle>
            <DialogDescription className="text-center text-sm sm:text-base px-2">
              Data pemusnahan shift {selectedShift} - kategori {selectedCategory} telah berhasil disimpan ke Google Spreadsheet.
            </DialogDescription>
          </DialogHeader>
          
          {showPdfButton && (
            <div className="bg-cyan-950/20 border border-cyan-700/30 rounded-lg p-4">
              <p className="text-sm text-cyan-300 text-center mb-3">
                📄 Generate PDF BA WASTE untuk tanggal ini?
              </p>
              <Button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="w-full h-11 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-medium transition-all duration-200"
              >
                {isGeneratingPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF BA WASTE
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowSuccessModal(false)}
              className="flex-1 h-11 sm:h-10 text-base sm:text-sm"
            >
              Tutup
            </Button>
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                setCurrentStep("date");
                setCompletedSteps([]);
                setSelectedCategory(null);
                setCategoryGroups([]);
                setShowPdfButton(false);
                setItemRows([{ ...emptyItemRow }]);
                resetForm();
                localStorage.removeItem('waste_form_cache');
                // Force refresh status input
                setStatusRefreshTrigger(prev => prev + 1);
              }}
              className="flex-1 h-11 sm:h-10 text-base sm:text-sm bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 transition-all duration-200"
            >
              Buat Entri Baru
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-red-950/40 border border-red-500/30 rounded-full flex items-center justify-center mb-3" style={{boxShadow: '0 0 20px rgba(239,68,68,0.2)'}}>
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <DialogTitle className="text-center text-lg">Reset Semua Data?</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Semua data yang sudah diinput akan dihapus dan tidak bisa dikembalikan. Yakin mau reset?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 h-11"
            >
              Batal
            </Button>
            <Button
              onClick={() => {
                setShowResetConfirm(false);
                setCurrentStep("date");
                setCompletedSteps([]);
                setSelectedCategory(null);
                setCategoryGroups([]);
                setEditingIndex(null);
                setItemRows([{ ...emptyItemRow }]);
                resetForm();
                localStorage.removeItem('waste_form_cache');
                toast({ title: "🗑️ Direset!", description: "Semua data udah ke-reset" });
                // Force refresh status input
                setStatusRefreshTrigger(prev => prev + 1);
              }}
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
            >
              Ya, Reset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
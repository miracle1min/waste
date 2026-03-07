import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle, FileText, Upload, Save, RotateCcw, Send, Sparkles, Edit, Trash2, X, LogOut } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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

type WasteItem = z.infer<typeof insertIndividualProductWithFilesSchema>;
type Category = "NOODLE" | "DIMSUM" | "BAR" | "PRODUKSI";

type CategoryGroup = {
  kategoriInduk: Category;
  items: WasteItem[];
};

type Step = "date" | "category" | "products" | "files" | "review";

const STEPS = [
  { id: "date", title: "Tanggal", description: "Pilih tanggal hari kerja" },
  { id: "category", title: "Kategori", description: "Pilih kategori produk" },
  { id: "products", title: "Produk", description: "Detail produk" },
  { id: "files", title: "Dokumen", description: "Upload berkas" },
  { id: "review", title: "Review", description: "Periksa data" },
];

// Simple logout button component
function LogoutButton() {
  const { logout, isLoggingOut } = useAuth();
  
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
      className="p-2 w-10 h-10"
      title="Keluar"
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
  
  const [currentStep, setCurrentStep] = useState<Step>("date");
  const [completedSteps, setCompletedSteps] = useState<Step[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentWIBDateString());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [customProductName, setCustomProductName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const productFormRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to product form when entering products step
  useEffect(() => {
    if (currentStep === "products" && productFormRef.current) {
      productFormRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [currentStep]);

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
      setCurrentStep("date");
      setCompletedSteps([]);
      setSelectedCategory(null);
      setCategoryGroups([]);
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
    submitMutation.mutate(group);
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
      case "files":
        return true; // Files are optional
      case "review":
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      {/* Header - Fixed responsive design */}
      <div className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0">
                <img 
                  src={wasteLogo} 
                  alt="WASTE Logo" 
                  className="h-10 w-auto sm:h-12 md:h-14 lg:h-16 rounded-lg"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-heading font-bold heading-gradient truncate">
                  BA WASTE
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
                  V.3.1.1 | Made With ☕ By{' '}
                  <a 
                    href="https://www.facebook.com/hipnotismagic" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors duration-200 font-semibold"
                  >
                    Marko
                  </a>
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        {/* Step Wizard */}
        <StepWizard 
          steps={STEPS} 
          currentStep={currentStep} 
          completedSteps={completedSteps}
          className="mb-4 sm:mb-6"
        />

        {/* Step Content - Improved responsive design */}
        <div className="form-step animate-slide-in bg-background/60 border border-border/50 rounded-lg overflow-hidden">
          <div className="p-4 sm:p-6">{/* Consistent padding across screen sizes */}
            
            {/* Step 1: Date Selection */}
            {currentStep === "date" && (
              <div className="space-y-4 sm:space-y-6">{/* Reduced spacing for mobile */}
                <div className="text-center">
                  <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-primary mb-3 sm:mb-4" />
                  <h2 className="text-xl sm:text-2xl font-heading font-bold mb-2">Pilih Tanggal Hari Kerja</h2>
                  <p className="text-sm sm:text-base text-muted-foreground px-4">Pilih tanggal untuk pencatatan pemusnahan produk (menentukan sheet di Spreadsheet)</p>
                </div>
                
                <div className="max-w-sm sm:max-w-md mx-auto space-y-4 sm:space-y-6">
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
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                      <p className="text-sm sm:text-base text-blue-800 dark:text-blue-200 text-center">
                        <strong>Tanggal terpilih:</strong><br className="sm:hidden" />
                        <span className="sm:ml-2">{formatWIBIndonesian(selectedDate)}</span>
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                      <strong>Penting:</strong> Tanggal ini akan menentukan nama sheet di Google Spreadsheet. Pilih tanggal hari kerja yang sesuai untuk menghindari data masuk ke sheet yang salah.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Category Selection */}
            {currentStep === "category" && (
              <div className="space-y-4 sm:space-y-6">{/* Reduced spacing for mobile */}
                <div className="text-center">
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-primary mb-3 sm:mb-4" />
                  <h2 className="text-xl sm:text-2xl font-heading font-bold mb-2">Pilih Station</h2>
                  <p className="text-sm sm:text-base text-muted-foreground px-4">Pilih station yang akan dimusnahkan</p>
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
                  className="max-w-lg sm:max-w-2xl mx-auto"
                />
              </div>
            )}

            {/* Step 3: Product Details */}
            {currentStep === "products" && selectedCategory && (
              <div className="space-y-4 sm:space-y-6">{/* Reduced spacing for mobile */}
                <div className="text-center">
                  <Upload className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-primary mb-3 sm:mb-4" />
                  <h2 className="text-xl sm:text-2xl font-heading font-bold mb-2">
                    {editingIndex !== null ? `Edit Produk - ${selectedCategory}` : `Detail Produk - ${selectedCategory}`}
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground px-4">
                    {editingIndex !== null ? 'Edit detail produk yang akan dimusnahkan' : 'Masukkan detail produk yang akan dimusnahkan'}
                  </p>
                </div>

                <Form {...form}>
                  <form ref={productFormRef} className="space-y-6 max-w-full md:max-w-2xl mx-auto">
                    <div className="space-y-4 md:space-y-6">{/* Changed from grid to vertical layout for better mobile experience */}
                      <FormField
                        control={form.control}
                        name="namaProduk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nama Produk</FormLabel>
                            {selectedCategory && (selectedCategory === "DIMSUM" || selectedCategory === "PRODUKSI") ? (
                              <div className="space-y-3">
                                <Select onValueChange={(value) => {
                                  field.onChange(value);
                                  setCustomProductName("");
                                }} value={field.value && !customProductName ? field.value : ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Pilih produk" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {PREDEFINED_PRODUCTS[selectedCategory as keyof typeof PREDEFINED_PRODUCTS].map((product) => (
                                      <SelectItem key={product} value={product}>{product}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input 
                                  placeholder="Atau masukkan nama produk lain (optional)"
                                  className="text-base"
                                  value={customProductName}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setCustomProductName(value);
                                    field.onChange(value);
                                  }}
                                />
                              </div>
                            ) : (
                              <FormControl>
                                <Input 
                                  placeholder={
                                    selectedCategory === "NOODLE" ? "Cth: PANGSIT GORENG, MIE" :
                                    selectedCategory === "BAR" ? "Cth: APEL, PEER, STROBERI" :
                                    selectedCategory === "PRODUKSI" ? "Cth: KULIT PANGSIT" :
                                    selectedCategory === "DIMSUM" ? "Cth: UDANG KEJU, SIOMAY" :
                                    "Contoh: Nama Produk"
                                  }
                                  className="text-base"
                                  {...field}
                                />
                              </FormControl>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="kodeProduk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kode Lot/Exp</FormLabel>
                            <FormControl>
                              <Input placeholder="Contoh: 010825.01" className="text-base min-h-[44px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="jumlahProduk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jumlah Produk</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1}
                                placeholder="0"
                                className="text-base min-h-[44px]"
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="min-h-[44px]">
                                  <SelectValue placeholder="Pilih unit" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="PCS">PCS</SelectItem>
                                <SelectItem value="PORSI">PORSI</SelectItem>
                                <SelectItem value="PACK">PACK</SelectItem>
                                <SelectItem value="GRAM">GRAM</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="metodePemusnahan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Metode Pemusnahan</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Pilih metode" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="DI BUANG">DI BUANG</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="alasanPemusnahan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alasan Pemusnahan</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="min-h-[44px]">
                                  <SelectValue placeholder="Pilih alasan pemusnahan" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="HANDLING">HANDLING</SelectItem>
                                <SelectItem value="KUALITAS EKSTERNAL">KUALITAS EKSTERNAL</SelectItem>
                                <SelectItem value="SUSUT">SUSUT</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="alasanPemusnahanManual"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alasan Lainnya (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Tulis alasan lainnya jika diperlukan"
                                className="text-base min-h-[44px]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="jamTanggalPemusnahan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jam & Tanggal Pemusnahan</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" className="text-base min-h-[44px]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col sm:flex-row gap-3">
                      {editingIndex !== null ? (
                        <>
                          <Button
                            type="button"
                            onClick={updateItemInCurrentGroup}
                            className="flex-1 min-h-[48px] text-base sm:text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium"
                            disabled={!form.watch("namaProduk") || !form.watch("kodeProduk") || !form.watch("jumlahProduk") || !form.watch("unit") || !form.watch("metodePemusnahan")}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Update Produk
                          </Button>
                          <Button
                            type="button"
                            onClick={cancelEdit}
                            variant="outline"
                            className="min-h-[48px] text-base sm:text-sm"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Batal
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          onClick={addItemToCurrentGroup}
                          className="w-full min-h-[48px] text-base sm:text-sm bg-green-600 hover:bg-green-700 text-white font-medium"
                          disabled={!form.watch("namaProduk") || !form.watch("kodeProduk") || !form.watch("jumlahProduk") || !form.watch("unit") || !form.watch("metodePemusnahan")}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Tambah Produk ke {selectedCategory}
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>

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
                  <Upload className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-primary mb-3 sm:mb-4" />
                  <h2 className="text-xl sm:text-2xl font-bold mb-2">Upload Dokumen</h2>
                  <p className="text-sm sm:text-base text-muted-foreground">Upload paraf dan dokumentasi (opsional)</p>
                </div>

                <div className="max-w-full sm:max-w-2xl mx-auto space-y-4 sm:space-y-6">
                  <ParafSelector
                    label="Paraf QC"
                    description="Pilih nama untuk paraf QC"
                    value={form.watch("parafQCName")}
                    onValueChange={(value) => {
                      form.setValue("parafQCName", value);
                      updateCategoryFiles('parafQCName', value);
                    }}
                  />

                  <ParafManagerSelector
                    label="Paraf Manager"
                    description="Pilih nama untuk paraf Manager"
                    value={form.watch("parafManagerName")}
                    onValueChange={(value) => {
                      form.setValue("parafManagerName", value);
                      updateCategoryFiles('parafManagerName', value);
                    }}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Dokumentasi</label>
                    <p className="text-xs text-muted-foreground">Upload foto dokumentasi pemusnahan (maksimal 10 file)</p>
                    <MultiFileUpload
                      files={form.watch("dokumentasiFiles") || []}
                      onFilesSelect={(files) => {
                        form.setValue("dokumentasiFiles", files);
                        updateCategoryFiles('dokumentasiFiles', files);
                      }}
                      maxFiles={10}
                      label="Upload Dokumentasi"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === "review" && selectedCategory && currentGroup && (
              <div className="space-y-4 sm:space-y-6">{/* Reduced spacing for mobile */}
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-success mb-3 sm:mb-4" />
                  <h2 className="text-xl sm:text-2xl font-bold mb-2">Review Data</h2>
                  <p className="text-sm sm:text-base text-muted-foreground px-4">Periksa kembali data sebelum mengirim</p>
                </div>

                <div className="max-w-full sm:max-w-3xl mx-auto space-y-3 sm:space-y-4">
                  <div className="bg-muted/20 rounded-lg p-3 sm:p-4 border border-border/50">{/* Reduced padding and lighter background for mobile */}
                    <h3 className="text-lg font-semibold mb-4">Ringkasan Pengiriman</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Tanggal:</span>
                        <p className="font-medium">{formatWIBForDisplay(selectedDate)}</p>
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

                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 sm:p-4">{/* Reduced padding for mobile */}
                    <h4 className="font-semibold text-warning-foreground dark:text-warning mb-2">
                      ⚠️ Konfirmasi Pengiriman
                    </h4>
                    <p className="text-sm text-warning-foreground dark:text-warning">
                      Data akan langsung dikirim ke Google Spreadsheet dan tidak dapat dibatalkan. 
                      Pastikan semua informasi sudah benar.
                    </p>
                  </div>

                  <Button
                    onClick={submitCurrentGroup}
                    disabled={isSubmitting}
                    className="w-full h-12 sm:h-14 text-base sm:text-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold shadow-lg"
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
                    className="flex items-center justify-center gap-2 min-h-[48px] px-8 text-base sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
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
                  setCurrentStep("date");
                  setCompletedSteps([]);
                  setSelectedCategory(null);
                  setCategoryGroups([]);
                  setEditingIndex(null);
                  resetForm();
                }}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] text-base sm:text-sm bg-red-50 hover:bg-red-100 text-red-600 border-red-200 hover:border-red-300 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-400 dark:border-red-800 dark:hover:border-red-700"
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
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center text-lg sm:text-xl">Data Berhasil Dikirim!</DialogTitle>
            <DialogDescription className="text-center text-sm sm:text-base px-2">
              Data pemusnahan kategori {selectedCategory} telah berhasil disimpan ke Google Spreadsheet.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6">
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
                resetForm();
              }}
              className="flex-1 h-11 sm:h-10 text-base sm:text-sm bg-primary hover:bg-primary/90"
            >
              Buat Entri Baru
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
}
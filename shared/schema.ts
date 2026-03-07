import { z } from "zod";

// Individual product schema for form handling
export const insertIndividualProductSchema = z.object({
  tanggal: z.string().min(1, "Tanggal harus diisi"),
  kategoriInduk: z.enum(["NOODLE", "DIMSUM", "BAR", "PRODUKSI"], {
    errorMap: () => ({ message: "Kategori induk harus dipilih" })
  }),
  namaProduk: z.string().min(1, "Nama produk harus diisi"),
  kodeProduk: z.string().min(1, "Kode produk harus diisi"),
  jumlahProduk: z.union([z.string().min(1, "Jumlah produk harus diisi"), z.number().min(1, "Jumlah produk minimal 1")]).transform((val) => {
    const numVal = typeof val === 'string' ? parseInt(val, 10) : val;
    return isNaN(numVal) || numVal < 1 ? 1 : numVal;
  }),
  unit: z.string().min(1, "Unit harus dipilih"),
  metodePemusnahan: z.string().min(1, "Metode pemusnahan harus dipilih"),
  alasanPemusnahan: z.string().optional(),
  alasanPemusnahanManual: z.string().optional(),
  jamTanggalPemusnahan: z.string().min(1, "Jam & tanggal pemusnahan harus diisi"),
  parafQCName: z.string().optional(),
  parafManagerName: z.string().optional(),
  dokumentasiUrl: z.string().optional(),
  // Fields used by submit-group
  parafQCUrl: z.string().optional(),
  parafManagerUrl: z.string().optional(),
});

// Grouped product destruction schema
export const insertProductDestructionSchema = z.object({
  tanggal: z.string().min(1, "Tanggal harus diisi"),
  kategoriInduk: z.enum(["NOODLE", "DIMSUM", "BAR", "PRODUKSI"], {
    errorMap: () => ({ message: "Kategori induk harus dipilih" })
  }),
  productList: z.array(z.string().min(1, "Nama produk harus diisi")).min(1, "Minimal 1 produk harus diisi"),
  kodeProdukList: z.array(z.string().min(1, "Kode produk harus diisi")).min(1, "Minimal 1 kode produk harus diisi"),
  jumlahProdukList: z.array(z.number().min(1, "Jumlah produk minimal 1")).min(1, "Minimal 1 jumlah produk harus diisi"),
  unitList: z.array(z.string().min(1, "Unit harus dipilih")).min(1, "Minimal 1 unit harus dipilih"),
  metodePemusnahanList: z.array(z.string().min(1, "Metode pemusnahan harus dipilih")).min(1, "Minimal 1 metode pemusnahan harus diisi"),
  alasanPemusnahanList: z.array(z.string().optional()).min(1, "Minimal 1 alasan pemusnahan harus diisi"),
  jamTanggalPemusnahan: z.string().min(1, "Jam & tanggal pemusnahan harus diisi"),
  parafQCName: z.string().optional(),
  parafManagerName: z.string().optional(),
  dokumentasiUrl: z.string().optional(),
});

// Schema for form with file fields (for individual products)
export const insertIndividualProductWithFilesSchema = insertIndividualProductSchema.extend({
  parafQCName: z.string().optional(),
  parafManagerName: z.string().optional(),
  dokumentasiFiles: z.array(z.any()).optional().default([]),
  dokumentasiFile: z.any().optional(),
  parafQCFile: z.any().optional(),
  parafManagerFile: z.any().optional(),
});

// Schema for grouped submission with file fields
export const insertProductDestructionWithFilesSchema = insertProductDestructionSchema.extend({
  parafQCName: z.any().optional(),
  parafManagerName: z.any().optional(),
  dokumentasiFile: z.any().optional(),
  dokumentasiFiles: z.array(z.any()).optional().default([]),
});

export type InsertProductDestruction = z.infer<typeof insertProductDestructionSchema>;
export type InsertIndividualProduct = z.infer<typeof insertIndividualProductSchema>;
export type InsertIndividualProductWithFiles = z.infer<typeof insertIndividualProductWithFilesSchema>;
export type InsertProductDestructionWithFiles = z.infer<typeof insertProductDestructionWithFilesSchema>;

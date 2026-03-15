import { z } from "zod";

// Login validation
export const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi").max(100).trim(),
  password: z.string().min(1, "Password wajib diisi").max(200),
  tenant_id: z.string().max(100).optional(),
});

// Date parameter validation (YYYY-MM-DD format)
export const dateParamSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Format tanggal harus YYYY-MM-DD"
);

// Dashboard query validation
export const dashboardQuerySchema = z.object({
  startDate: dateParamSchema.optional(),
  endDate: dateParamSchema.optional(),
  mode: z.string().optional(),
  // activity-log params
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  action: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  tenant_id: z.string().max(100).optional(),
  username: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().max(200).optional(),
}).refine(
  (data) => {
    // If one date is provided, both must be provided
    if ((data.startDate && !data.endDate) || (!data.startDate && data.endDate)) {
      return false;
    }
    return true;
  },
  { message: "startDate dan endDate harus diisi bersamaan" }
);

// Get day data query validation
export const getDayDataQuerySchema = z.object({
  date: dateParamSchema,
  shift: z.string().max(50).optional(),
  station: z.string().max(100).optional(),
  tenant_id: z.string().max(100).optional(),
});

// Proxy image URL validation
export const proxyImageSchema = z.object({
  url: z.string().url("URL tidak valid").max(2000),
});

// Signature query validation
export const signatureQuerySchema = z.object({
  name: z.string().max(200).optional(),
  role: z.enum(["qc", "manager", ""]).optional(),
  tenant_id: z.string().max(100).optional(),
});

// User creation validation
export const createUserSchema = z.object({
  username: z.string().min(1, "Username wajib").max(100).trim(),
  password: z.string().min(6, "Password minimal 6 karakter").max(200),
  display_name: z.string().max(200).optional(),
  role: z.enum(["super_admin", "admin_store"]).optional().default("admin_store"),
  tenant_id: z.string().max(100).nullable().optional(),
});

// User update validation
export const updateUserSchema = z.object({
  id: z.number({ required_error: "User ID wajib" }),
  password: z.string().min(6).max(200).optional(),
  display_name: z.string().max(200).optional(),
  role: z.enum(["super_admin", "admin_store"]).optional(),
  tenant_id: z.string().max(100).nullable().optional(),
  status: z.string().max(50).optional(),
});

// Tenant creation validation
export const createTenantSchema = z.object({
  id: z.string().min(1, "ID store wajib").max(100).trim(),
  name: z.string().min(1, "Nama store wajib").max(200).trim(),
  address: z.string().max(500).optional().default(""),
  phone: z.string().max(50).optional().default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  neon_database_url: z.string().max(500).optional().default(""),
});

// Personnel creation validation
export const createPersonnelSchema = z.object({
  tenant_id: z.string().min(1, "tenant_id wajib").max(100),
  name: z.string().min(1, "Nama wajib").max(200),
  full_name: z.string().max(200).optional(),
  role: z.enum(["qc", "manager"], { required_error: "Role harus qc atau manager" }),
  signature_url: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

/**
 * Helper: validate input and return parsed data or send error response.
 * Returns null if validation failed (response already sent).
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  res: import("@vercel/node").VercelResponse
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    res.status(400).json({
      error: firstError.message,
      details: result.error.errors.map(e => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return null;
  }
  return result.data;
}

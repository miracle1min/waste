# AI RULES — AWAS (Aplikasi Waste Always Simple)

## Project Identity
- **Name**: AWAS — Aplikasi Waste Always Simple
- **Owner**: PT. Pesta Pora Abadi
- **Domain**: Waste/destruction tracking for restaurant outlets (F&B)
- **Version**: 3.2.0
- **License**: Private

## Tech Stack
- **Frontend**: React 18 + TypeScript 5 + Vite 5 + Tailwind CSS 3 + shadcn/ui (new-york style)
- **Backend**: Vercel Serverless Functions (`/api/*`)
- **Database**: Neon PostgreSQL (serverless, multi-tenant)
- **Storage**: Cloudflare R2 (photos)
- **Export**: Google Sheets API v4
- **Auth**: JWT (HMAC-SHA256) + scrypt password hashing, 8hr sessions
- **Routing**: Wouter (client-side)
- **State**: TanStack React Query v5 + React Context (AuthContext)
- **Charts**: Recharts
- **PDF**: jsPDF + autotable + html2canvas (lazy loaded)
- **AI**: Gemini API (key pool with sticky-hash strategy)
- **PWA**: Service worker + manifest

## Architecture — Multi-Tenant
- **Master DB** (`NEON_DATABASE_URL`): tenants registry, super_admin users, activity_logs, gemini_api_keys
- **Per-Tenant DB** (`tenants.neon_database_url`): users, tenant_configs, personnel, product_destructions
- Tenant resolution: `tenant-db.ts` caches DB URLs (TTL 60s), falls back to master if no tenant URL
- Auth enforcement: `getAuthorizedTenantId()` — admin_store uses JWT tenantId (tamper-proof), super_admin can override via `x-tenant-id` header
- API requests: `x-tenant-id` header + `Authorization: Bearer <JWT>` header on every call

## Path Aliases
- `@/*` → `src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## Key Conventions
- **Language**: All user-facing strings are in **Bahasa Indonesia** (informal/semi-formal)
- **Timezone**: All business logic uses **WIB (Asia/Jakarta, GMT+7)** via `shared/timezone.ts` and `src/lib/timezone.ts`
- **Business date cutoff**: 05:00 WIB — before 05:00 counts as previous day (Midnight shift)
- **Shifts**: OPENING (05:00-11:59), MIDDLE (12:00-16:59), CLOSING (17:00-23:59), MIDNIGHT (00:00-04:59)
- **Design theme**: Dark cyberpunk/neo-brutalism — deep navy backgrounds, cyan accents (#06b6d4/#4FD1FF), yellow highlights (#FFE500), hard drop shadows (`shadow-nb-md`)
- **Design system**: shadcn/ui components (`src/components/ui/`), Radix primitives, CSS variables for theming
- **Component style**: New York variant, rounded-xl/2xl cards, border-[#222]/border-[#2a2a2a], bg-[#111]/bg-[#0a0a0a]

## API Structure
- `api/_lib/` — shared backend libs (auth, db, tenant-db, rate-limit, r2, google-sheets, gemini-key-pool, rag, activity-logger, etc.)
- `api/auth/login.ts` — login endpoint (JWT + scrypt)
- `api/auth/google.ts` — Google OAuth login
- `api/submit-grouped.ts` — manual waste submission (multipart/form-data)
- `api/auto-submit.ts` — auto waste submission (JSON)
- `api/dashboard-data.ts` — dashboard analytics
- `api/get-day-data.ts` — daily waste data
- `api/check-duplicate.ts` — duplicate checker
- `api/signatures.ts` — personnel signatures
- `api/proxy-image.ts` — R2 image proxy
- `api/ai-chat.ts` — AI assistant (Gemini)
- `api/qc-chat.ts` — QC helper chat (Gemini)
- `api/ingest-soc.ts` — SOC data ingester
- `api/settings/` — CRUD: tenants, users, personnel, configs, gemini-keys

## Auth System
- `src/contexts/AuthContext.tsx` → `useAuthContext()` / `useAuth()` — single source of truth for auth state
- `src/hooks/useAuth.ts` — actual auth hook (session management, activity extension, auto-logout)
- `src/lib/api-client.ts` — `apiFetch()` with auto-retry, tenant headers, 401/403 auto-logout
- `src/lib/queryClient.ts` — React Query client with auto-auth headers and 401/403 handling
- **Session**: 8hr duration, stored in localStorage (`waste_app_*` keys), auto-extend on user activity (throttled 60s)
- **Global auth event**: `auth:session-expired` CustomEvent dispatched from api-client → handled by useAuth → auto-logout
- **Cross-tab logout**: StorageEvent listener clears session if another tab logs out
- **Roles**: `super_admin` (global access, admin panel) vs `admin_store` (tenant-scoped, waste operations)

## Frontend Routing (App.tsx)
- `super_admin` → `AdminRouter` (admin-panel, dashboard)
- `admin_store` → `UserRouter` (waste-mode, auto-waste, dashboard, pdf, profile, ai)
- All pages lazy-loaded via `React.lazy()`
- `AppErrorBoundary` wraps entire app for crash recovery
- `ThemeProvider` (dark default), `PWAInstallPrompt`, Vercel Analytics/Speed Insights (lazy)

## Pages
- `/` → `waste-mode.tsx` — home mode selector (Manual / Auto)
- `/manual-waste` / `/auto-waste` → `auto-waste.tsx` — waste submission forms
- `/dashboard` → `dashboard.tsx` — analytics & charts
- `/pdf` → `pdf-download.tsx` — PDF export
- `/profile` → `profile.tsx` — user profile
- `/ai` → `ai-assistant.tsx` — AI chat helper
- Admin pages: overview, tenants, users, google-users, personnel, configs, gemini-keys, database, activity

## Database Ops (`api/_lib/database-ops.ts`)
- Auto-creates tables in tenant DB on init
- `product_destructions` table is core business table
- Activity logs in master DB (`activity_logs` table, auto-created)

## Security Rules
- Never expose `NEON_DATABASE_URL`, `JWT_SECRET`, `R2_SECRET_ACCESS_KEY`, `GOOGLE_SHEETS_CREDENTIALS` in client code
- API keys (Gemini) stored in master DB, never sent to client (server-side only)
- Rate limiting on login endpoint (in-memory, best-effort in serverless)
- scrypt password hashing (no bcrypt dependency)
- Cross-tenant data isolation enforced server-side via JWT tenantId

## Environment Variables (.env)
- `NEON_DATABASE_URL` — master DB connection string
- `JWT_SECRET` — required, min 32 chars
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEETS_CREDENTIALS` — JSON service account key
- `GOOGLE_DRIVE_FOLDER_ID` — optional

## Vite Build
- `vite build` → `dist/` directory
- Manual chunks: vendor-charts, vendor-ui, vendor-react, vendor-query, vendor-utils
- jspdf/html2canvas NOT in manualChunks (lazy-loaded via dynamic import)
- Version plugin generates `public/version.json` with build hash + timestamp
- Async CSS plugin for performance
- Dev proxy: `/api` → `http://localhost:3000`

## Build & Deploy
- `npm run dev` — Vite dev server (port 5000)
- `npm run dev:vercel` — Vercel dev with API routing
- `npm run build` — production build
- `npm run typecheck` — TypeScript check (both frontend + API)
- Deploy: Vercel (auto-detected framework, `vercel --prod`)
- `npm run lint` — no linter configured (TBD)

## Common Pitfalls
- **Multi-tenant queries**: Always use `tenantQuery()` for tenant-scoped data, never raw `query()` on master DB
- **WIB timezone**: Never use `new Date()` for business dates — always use `getBusinessDateWIB()` or `getCurrentWIBDateString()`
- **Auth headers**: Frontend must sent `x-tenant-id` + `Authorization: Bearer` on every API call
- **React imports**: Components use named imports from `@/contexts/AuthContext` (not directly from `useAuth`)
- **Lazy loading**: All pages loaded via `React.lazy()`, wrapped in `<Suspense>`
- **Error messages**: User-facing errors in Bahasa Indonesia, console errors in English
- **DB connections**: `neon()` from `@neondatabase/serverless` — tagged template literals for master DB, parameterized `$1,$2...` for tenant DB
- **Rate limiting**: Serverless-environment aware (per-instance, not distributed) — documented as best-effort

## File Naming
- Pages: `kebab-case.tsx` in `src/pages/` (or `src/pages/admin/` for admin sub-pages)
- API: `kebab-case.ts` in `api/` (or `api/_lib/` for shared libs, `api/settings/_handlers/` for CRUD)
- Components: `kebab-case.tsx` in `src/components/ui/`
- Hooks: `kebab-case.ts` in `src/hooks/`
- Libs: `kebab-case.ts` in `src/lib/`
- Shared: `kebab-case.ts` in `shared/`
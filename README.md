<p align="center">
  <img src="attached_assets/waste-logo_1753322218969.webp" alt="AWAS Logo" width="120" />
</p>

<h1 align="center">🗑️ AWAS — Aplikasi Waste Always Simple</h1>

<p align="center">
  <strong>Sistem pencatatan & pemusnahan produk digital untuk PT. Pesta Pora Abadi</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.2.0-cyan?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Vercel-Serverless-000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Neon-PostgreSQL-00E599?style=for-the-badge&logo=postgresql&logoColor=white" alt="Neon" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/Multi--Tenant-Architecture-FF6F00?style=flat-square" alt="Multi-Tenant" />
  <img src="https://img.shields.io/badge/Timezone-WIB_(GMT%2B7)-green?style=flat-square" alt="WIB" />
  <img src="https://img.shields.io/badge/License-Private-red?style=flat-square" alt="License" />
</p>

---

## 📖 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🗄️ Database Schema](#️-database-schema)
- [🔐 Authentication & Authorization](#-authentication--authorization)
- [🌐 API Endpoints](#-api-endpoints)
- [📱 Pages & Routes](#-pages--routes)
- [⏰ Timezone & Business Date Logic](#-timezone--business-date-logic)
- [🚀 Getting Started](#-getting-started)
- [📦 Deployment](#-deployment)
- [🔧 Environment Variables](#-environment-variables)
- [🤝 Contributing](#-contributing)

---

## 🎯 Overview

**AWAS** (Aplikasi Waste Always Simple) adalah aplikasi web progressive (PWA) yang digunakan oleh **PT. Pesta Pora Abadi** untuk mencatat dan mengelola proses pemusnahan produk makanan & minuman di seluruh outlet restoran mereka.

Aplikasi ini mendukung arsitektur **multi-tenant**, di mana setiap outlet/store memiliki database terpisah di Neon PostgreSQL, namun dikelola secara terpusat oleh **super admin**.

### 🎯 Tujuan Utama
| # | Tujuan | Deskripsi |
|---|--------|-----------|
| 1 | 📋 **Pencatatan Digital** | Menggantikan form kertas untuk pencatatan waste produk |
| 2 | 📊 **Dashboard & Analitik** | Visualisasi data waste harian/bulanan per outlet |
| 3 | 🔒 **Audit Trail** | Setiap pemusnahan tercatat dengan paraf QC & Manager |
| 4 | 📸 **Dokumentasi Foto** | Upload foto bukti pemusnahan ke Cloudflare R2 |
| 5 | 📄 **Export Google Sheets** | Otomatis sync data ke Google Sheets per outlet |
| 6 | 🏢 **Multi-Outlet** | Satu sistem untuk banyak store dengan isolasi data |

---

## ✨ Features

### 📝 Manual Waste Entry
- Step-by-step wizard form dengan validasi Zod
- Pilih kategori: 🍜 **Noodle** · 🥟 **Dimsum** · 🍹 **Bar** · 🏭 **Produksi**
- Input produk, kode lot, jumlah, unit, metode & alasan pemusnahan
- Upload multi-file dokumentasi foto
- Pilih paraf QC & Manager dari personnel terdaftar
- Deteksi duplikasi entry otomatis

### ⚡ Auto Waste (Paste & Submit)
- Paste data langsung dari clipboard (format terstruktur)
- Auto-parse nama produk, kode lot, dan quantity
- Preview sebelum submit
- Bulk submission dalam sekali kirim

### 📊 Dashboard & Reporting
- Chart harian: Bar, Line, Pie (via Recharts)
- Filter by date range, station, shift
- Summary statistik: total items, total qty, rata-rata harian
- Export data ke file
- Multi-tenant view untuk super admin

### ⚙️ Admin Panel (Super Admin)
- 🏪 **Tenant Management** — CRUD outlet/store, assign Neon DB URL
- 👥 **User Management** — CRUD users per tenant, assign roles
- 🔧 **Config Management** — Setup Google Sheets & R2 credentials per tenant
- 👤 **Personnel Management** — CRUD QC & Manager dengan signature upload
- 🗄️ **Database Operations** — Init/migrate tenant database schema

### 🔐 Security
- JWT-based authentication (scrypt password hashing)
- Role-based access control (`super_admin` / `admin_store`)
- 8-hour session duration with auto-extend on activity
- Server-side auth verification on every API call

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser/PWA)                     │
│  React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui       │
│  Wouter (routing) · React Query (caching) · Recharts (charts)  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS (JWT + x-tenant-id header)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL SERVERLESS FUNCTIONS                   │
│                       /api/* endpoints                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Auth 🔐 │  │ Submit 📝│  │ Dashboard│  │  Settings ⚙️  │  │
│  │  login   │  │ grouped  │  │  data 📊 │  │ tenants/users │  │
│  │  JWT     │  │ auto     │  │  charts  │  │ configs/pers. │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │             │                │            │
│       ▼              ▼             ▼                ▼            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              _lib/ (Shared Backend Libraries)            │    │
│  │  auth.ts · db.ts · tenant-db.ts · tenant-resolver.ts   │    │
│  │  r2.ts · google-sheets.ts · parse-form.ts              │    │
│  └────────────────────┬────────────────────────────────────┘    │
└───────────────────────┼─────────────────────────────────────────┘
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
   ┌────────────┐ ┌──────────┐  ┌───────────┐
   │ 🐘 Neon    │ │ ☁️ R2    │  │ 📄 Google │
   │ PostgreSQL │ │ Storage  │  │  Sheets   │
   │ (Master +  │ │ (Photos) │  │ (Export)  │
   │ Per-Tenant)│ │          │  │           │
   └────────────┘ └──────────┘  └───────────┘
```

### 🏢 Multi-Tenant Data Flow

```
                    ┌──────────────────┐
                    │   MASTER DB 🐘   │
                    │  (Neon Postgres)  │
                    │                  │
                    │  ┌────────────┐  │
                    │  │  tenants   │  │
                    │  │  table     │  │
                    │  └─────┬──────┘  │
                    └────────┼─────────┘
                             │ lookup neon_database_url
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
        ┌────────────┐ ┌────────────┐ ┌────────────┐
        │ 🏪 Store A │ │ 🏪 Store B │ │ 🏪 Store C │
        │  Tenant DB │ │  Tenant DB │ │  Tenant DB │
        │ - users    │ │ - users    │ │ - users    │
        │ - configs  │ │ - configs  │ │ - configs  │
        │ - products │ │ - products │ │ - products │
        │ - personnel│ │ - personnel│ │ - personnel│
        └────────────┘ └────────────┘ └────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose | Version |
|:----------:|---------|---------|
| ⚛️ React | UI Framework | 18.x |
| 🔷 TypeScript | Type Safety | 5.6 |
| ⚡ Vite | Build Tool & Dev Server | 5.x |
| 🎨 Tailwind CSS | Utility-first Styling | 4.x |
| 🧩 shadcn/ui | UI Component Library | — |
| 🔗 Wouter | Lightweight Routing | 3.x |
| 🔄 TanStack Query | Server State Management | 5.x |
| 📊 Recharts | Charts & Data Visualization | 2.x |
| 📋 React Hook Form | Form Management | 7.x |
| ✅ Zod | Schema Validation | 3.x |
| 🖼️ Lucide React | Icon Library | — |

### Backend
| Technology | Purpose | Version |
|:----------:|---------|---------|
| ▲ Vercel Functions | Serverless API | — |
| 🐘 Neon PostgreSQL | Database (Multi-Tenant) | — |
| ☁️ Cloudflare R2 | Object Storage (Photos) | — |
| 📄 Google Sheets API | Data Export | v4 |
| 🔐 JWT | Authentication | — |
| 🔑 scrypt | Password Hashing | — |
| 📦 @aws-sdk/client-s3 | R2 Integration | 3.x |

---

## 📁 Project Structure

```
waste/
├── 📄 index.html                    # Entry point HTML
├── 📄 package.json                  # Dependencies & scripts
├── 📄 vite.config.ts                # Vite configuration
├── 📄 tailwind.config.ts            # Tailwind configuration
├── 📄 tsconfig.json                 # TypeScript configuration
├── 📄 vercel.json                   # Vercel deployment config
├── 📄 postcss.config.js             # PostCSS configuration
├── 📄 components.json               # shadcn/ui configuration
├── 📄 .env.example                  # Environment variables template
│
├── 🔧 api/                          # ▲ Vercel Serverless Functions
│   ├── 📂 _lib/                     # Shared backend libraries
│   │   ├── auth.ts                  # 🔐 JWT + scrypt auth utilities
│   │   ├── db.ts                    # 🗄️ Master DB connection & queries
│   │   ├── tenant-db.ts            # 🏢 Per-tenant DB resolver
│   │   ├── tenant-resolver.ts      # 🔍 Tenant credentials resolver
│   │   ├── database-ops.ts         # ⚙️ DB init/migrate operations
│   │   ├── r2.ts                   # ☁️ Cloudflare R2 file upload
│   │   ├── google-sheets.ts        # 📄 Google Sheets integration
│   │   ├── cloudinary.ts           # 🖼️ Cloudinary (legacy)
│   │   └── parse-form.ts           # 📝 Multipart form parser
│   │
│   ├── 📂 auth/
│   │   └── login.ts                # 🔑 POST /api/auth/login
│   │
│   ├── 📂 settings/
│   │   ├── tenants.ts              # 🏪 CRUD /api/settings/tenants
│   │   ├── users.ts                # 👥 CRUD /api/settings/users
│   │   ├── configs.ts              # 🔧 CRUD /api/settings/configs
│   │   └── personnel.ts           # 👤 CRUD /api/settings/personnel
│   │
│   ├── submit-grouped.ts          # 📝 POST manual waste submission
│   ├── auto-submit.ts             # ⚡ POST auto waste submission
│   ├── dashboard-data.ts          # 📊 GET dashboard analytics
│   ├── check-duplicate.ts         # 🔍 GET duplicate checker
│   ├── get-day-data.ts            # 📅 GET daily waste data
│   ├── signatures.ts              # ✍️ GET personnel signatures
│   └── proxy-image.ts             # 🖼️ GET image proxy for R2
│
├── 📂 shared/                       # Shared between frontend & backend
│   ├── schema.ts                   # ✅ Zod validation schemas
│   └── timezone.ts                 # ⏰ WIB timezone utilities
│
├── 📂 src/                          # ⚛️ React Frontend
│   ├── 📄 main.tsx                  # App entry point
│   ├── 📄 App.tsx                   # Root component + routing
│   ├── 📄 index.css                 # Global styles
│   │
│   ├── 📂 pages/
│   │   ├── mode-selector.tsx       # 🏠 Home — mode selection
│   │   ├── product-destruction.tsx # 📝 Manual waste form
│   │   ├── auto-waste.tsx          # ⚡ Auto waste (paste & submit)
│   │   ├── dashboard.tsx           # 📊 Dashboard & analytics
│   │   ├── settings.tsx            # ⚙️ Settings (admin_store)
│   │   ├── admin-panel.tsx         # 🛡️ Admin panel (super_admin)
│   │   └── not-found.tsx           # 🚫 404 page
│   │
│   ├── 📂 components/ui/           # 🧩 UI Components (shadcn + custom)
│   │   ├── button.tsx, input.tsx, select.tsx, dialog.tsx, ...
│   │   ├── category-selector.tsx   # 🏷️ Station category picker
│   │   ├── step-wizard.tsx         # 📋 Multi-step form wizard
│   │   ├── file-upload-zone.tsx    # 📤 Drag & drop file upload
│   │   ├── multi-file-upload.tsx   # 📤 Multiple file upload
│   │   ├── paraf-selector.tsx      # ✍️ QC signature picker
│   │   ├── paraf-manager-selector.tsx # ✍️ Manager signature picker
│   │   ├── login-form.tsx          # 🔐 Login form
│   │   ├── footer.tsx              # 📎 App footer
│   │   ├── loading-spinner.tsx     # ⏳ Loading indicator
│   │   ├── mobile-drawer.tsx       # 📱 Mobile drawer
│   │   ├── theme-provider.tsx      # 🎨 Theme provider (dark cyberpunk)
│   │   └── ...                     # Other shadcn/ui components
│   │
│   ├── 📂 hooks/
│   │   ├── useAuth.ts              # 🔐 Authentication hook
│   │   ├── useFormValidation.ts    # ✅ Form validation hook
│   │   ├── usePerformanceOptimization.ts # ⚡ Performance utils
│   │   ├── use-toast.ts            # 🔔 Toast notifications
│   │   └── use-mobile.tsx          # 📱 Mobile detection
│   │
│   ├── 📂 lib/
│   │   ├── api-client.ts           # 🌐 API client (auto tenant/JWT)
│   │   ├── queryClient.ts          # 🔄 TanStack Query client
│   │   └── utils.ts                # 🔧 Utility functions
│   │
│   └── 📂 utils/
│       └── errorHandler.ts         # ⚠️ Error handling utilities
│
├── 📂 public/
│   ├── favicon.webp                # 🖼️ Favicon
│   ├── logo-ppa.png                # 🖼️ Company logo
│   ├── manifest.json               # 📱 PWA manifest
│   ├── sw.js                       # 📱 Service worker
│   ├── 📂 icons/                   # 📱 PWA icons (144, 192, 512)
│   └── 📂 signatures/              # ✍️ Static signature images
│       ├── 📂 qc/                  # QC personnel signatures
│       └── 📂 manager/             # Manager signatures
│
└── 📂 attached_assets/
    └── waste-logo_1753322218969.webp  # 🖼️ App logo asset
```

---

## 🗄️ Database Schema

### Master Database (Neon)

```sql
-- 🏪 Tenants Registry
CREATE TABLE tenants (
    id              TEXT PRIMARY KEY,    -- e.g., 'store-001'
    name            TEXT NOT NULL,       -- 'Store Senayan City'
    address         TEXT,
    phone           TEXT,
    status          TEXT DEFAULT 'active',  -- 'active' | 'inactive'
    neon_database_url TEXT,              -- Per-tenant Neon DB URL
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Per-Tenant Database

```sql
-- 👥 Users
CREATE TABLE users (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL,
    username    TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,          -- scrypt hashed
    role        TEXT DEFAULT 'admin_store',  -- 'super_admin' | 'admin_store'
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 🔧 Tenant Configurations
CREATE TABLE tenant_configs (
    tenant_id               TEXT PRIMARY KEY,
    google_spreadsheet_id   TEXT,
    google_sheets_credentials TEXT,     -- JSON service account key
    r2_account_id           TEXT,
    r2_access_key_id        TEXT,
    r2_secret_access_key    TEXT,
    r2_bucket_name          TEXT,
    r2_public_url           TEXT,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 👤 Personnel (QC & Managers)
CREATE TABLE personnel (
    id             SERIAL PRIMARY KEY,
    tenant_id      TEXT NOT NULL,
    name           TEXT NOT NULL,       -- Short name (display)
    full_name      TEXT,                -- Full legal name
    role           TEXT NOT NULL,       -- 'qc' | 'manager'
    signature_url  TEXT,                -- URL to signature image
    status         TEXT DEFAULT 'active',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 📝 Product Destructions (Waste Records)
CREATE TABLE product_destructions (
    id                      SERIAL PRIMARY KEY,
    tenant_id               TEXT NOT NULL,
    tanggal                 DATE NOT NULL,
    kategori_induk          TEXT NOT NULL,     -- NOODLE | DIMSUM | BAR | PRODUKSI
    nama_produk             TEXT NOT NULL,
    kode_produk             TEXT,
    jumlah_produk           INTEGER NOT NULL,
    unit                    TEXT NOT NULL,
    metode_pemusnahan       TEXT NOT NULL,
    alasan_pemusnahan       TEXT,
    jam_tanggal_pemusnahan  TIMESTAMPTZ,
    paraf_qc_name           TEXT,
    paraf_qc_url            TEXT,
    paraf_manager_name      TEXT,
    paraf_manager_url       TEXT,
    dokumentasi_url         TEXT,              -- R2 photo URL(s)
    shift                   TEXT,              -- OPENING | MIDDLE | CLOSING | MIDNIGHT
    submitted_by            TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔐 Authentication & Authorization

### 🔑 Auth Flow

```
┌──────────┐    POST /api/auth/login     ┌──────────────┐
│  Client  │  ──────────────────────────▶ │   Server     │
│  (React) │    { username, password }    │  (Vercel fn) │
│          │                              │              │
│          │  ◀────────────────────────── │  Verify pwd  │
│          │    { token, user, tenants }  │  (scrypt)    │
│          │                              │  Issue JWT   │
└──────────┘                              └──────────────┘
     │
     │  Store in localStorage:
     │  - waste_app_token (JWT)
     │  - waste_app_tenant_id
     │  - waste_app_role
     │  - waste_app_qc_name
     │  - waste_app_tenant_name
     │  - waste_app_store_code
     │
     ▼
  All subsequent API calls include:
  - Header: Authorization: Bearer <JWT>
  - Header: x-tenant-id: <tenant_id>
```

### 👥 Roles

| Role | Scope | Capabilities |
|------|-------|-------------|
| 🛡️ `super_admin` | Global | Manage all tenants, users, configs, personnel, DB ops. Access admin panel. |
| 🏪 `admin_store` | Per-tenant | Submit waste, view dashboard, manage own store settings. |

### ⏱️ Session
- **Duration:** 8 hours
- **Auto-extend:** On user activity (throttled to 1x per minute)
- **Storage:** `localStorage` with timestamp check

---

## 🌐 API Endpoints

All endpoints are Vercel Serverless Functions under `/api/`.

### 🔑 Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | ❌ | Login → returns JWT + tenant list |

### 📝 Waste Operations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/submit-grouped` | ✅ | Submit manual waste (multipart/form-data) |
| `POST` | `/api/auto-submit` | ✅ | Submit auto waste (JSON) |
| `GET` | `/api/check-duplicate` | ✅ | Check for duplicate entries |
| `GET` | `/api/get-day-data` | ✅ | Get waste data for a specific date |

### 📊 Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/dashboard-data` | ✅ | Dashboard analytics & charts |

### ⚙️ Settings (Admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET/POST/PUT/DELETE` | `/api/settings/tenants` | 🛡️ | CRUD tenants |
| `GET/POST/PUT/DELETE` | `/api/settings/users` | 🛡️ | CRUD users |
| `GET/POST/PUT` | `/api/settings/configs` | 🛡️ | CRUD tenant configs |
| `GET/POST/PUT/DELETE` | `/api/settings/personnel` | ✅ | CRUD personnel |

### 🔧 Utility

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/signatures` | ✅ | Get personnel with signatures |
| `GET` | `/api/proxy-image` | ✅ | Proxy R2 images |

> 🛡️ = requires `super_admin` role · ✅ = requires valid JWT · ❌ = public

---

## 📱 Pages & Routes

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | `mode-selector.tsx` | ✅ | 🏠 Home — choose Manual or Auto waste mode |
| `/manual-waste` | `product-destruction.tsx` | ✅ | 📝 Multi-step manual waste form |
| `/auto-waste` | `auto-waste.tsx` | ✅ | ⚡ Paste & submit auto waste |
| `/dashboard` | `dashboard.tsx` | ✅ | 📊 Analytics & charts |
| `/settings` | `settings.tsx` | 🛡️ | ⚙️ Settings (redirect if not super_admin) |
| `/admin` | `admin-panel.tsx` | 🛡️ | 🛡️ Full admin panel |
| `/*` | `not-found.tsx` | ❌ | 🚫 404 page |

> When not authenticated, all routes show the **Login Form**.

---

## ⏰ Timezone & Business Date Logic

AWAS operates exclusively in **WIB (Waktu Indonesia Barat / GMT+7)**.

### 🕐 Business Day Cutoff

```
05:00 WIB = Business day boundary

00:00 ─── 04:59 WIB → Still counts as PREVIOUS day (Midnight shift)
05:00 ─── 23:59 WIB → Current day

Example:
  2026-03-08 02:46 WIB → Business date = 2026-03-07 (Midnight shift)
  2026-03-08 06:00 WIB → Business date = 2026-03-08 (Opening shift)
```

### 📋 Shifts

| Shift | Time Range | Emoji |
|-------|-----------|-------|
| 🌅 OPENING | 05:00 – 11:59 WIB | Morning prep |
| ☀️ MIDDLE | 12:00 – 16:59 WIB | Lunch rush |
| 🌆 CLOSING | 17:00 – 23:59 WIB | Dinner & close |
| 🌙 MIDNIGHT | 00:00 – 04:59 WIB | Late night (prev business day) |

### 🧰 Utility Functions (`shared/timezone.ts`)

| Function | Returns | Description |
|----------|---------|-------------|
| `getCurrentWIBDate()` | `Date` | Current WIB datetime |
| `getBusinessDateWIB()` | `Date` | Business date (with 05:00 cutoff) |
| `getCurrentWIBDateString()` | `YYYY-MM-DD` | Business date as string |
| `formatWIBForInput()` | `YYYY-MM-DDTHH:mm` | For `datetime-local` inputs |
| `formatWIBForDisplay()` | `DD/MM/YYYY HH:mm` | Human-readable format |
| `formatWIBForSheetTab()` | `DD/MM/YY` | Google Sheets tab name |
| `formatWIBIndonesian()` | `Senin, 10 Maret 2026` | Indonesian locale |
| `toWIBDate(date)` | `Date` | Convert any date to WIB |

---

## 🚀 Getting Started

### Prerequisites

- 📦 **Node.js** ≥ 18
- 📦 **npm** ≥ 9
- 🐘 **Neon PostgreSQL** account (for database)
- ▲ **Vercel** account (for deployment)
- ☁️ **Cloudflare R2** bucket (for photo storage)
- 📄 **Google Cloud** service account (for Sheets export)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/miracle1min/waste.git
cd waste

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Fill in your environment variables (see section below)
nano .env

# 5. Start development server
npm run dev
```

The app will be available at `http://localhost:5000` 🎉

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | 🔥 Start Vite dev server (port 5000) |
| `npm run build` | 📦 Build for production |
| `npm run preview` | 👀 Preview production build |

---

## 📦 Deployment

### Vercel (Recommended)

The project is configured for **Vercel** deployment with `vercel.json`:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Vercel Configuration:**
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Serverless Functions:** `/api/*` (auto-detected)
- **SPA Rewrites:** All non-API routes → `index.html`

### Environment Variables

Set all environment variables in your Vercel project settings.

---

## 🔧 Environment Variables

Create a `.env` file based on `.env.example`:

```env
# 🐘 Master Database (Neon PostgreSQL)
NEON_DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# 📄 Google Sheets (default/fallback)
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}

# ☁️ Cloudflare R2 Storage (default/fallback)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-r2-public-url.com

# 🔐 JWT Secret
JWT_SECRET=your-super-secret-jwt-key
```

> **Note:** Per-tenant credentials are stored in the `tenant_configs` table and take priority over env vars.

---

## 🎨 Design System

- **Theme:** Dark Cyberpunk 🌃
  - Background: Deep navy/dark (`hsl(220, 45%, 8%)`)
  - Primary: Cyan (`#06b6d4`)
  - Accent: Blue gradient (`cyan-400 → blue-500`)
- **Font:** System font stack
- **Icons:** Lucide React
- **Components:** shadcn/ui (Radix primitives)
- **Responsive:** Mobile-first PWA design

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<p align="center">
  <strong>Built with ❤️ by PT. Pesta Pora Abadi Engineering Team</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Made_in-Indonesia_🇮🇩-red?style=flat-square" alt="Made in Indonesia" />
  <img src="https://img.shields.io/badge/Powered_by-Neon_+_Vercel-06b6d4?style=flat-square" alt="Powered by" />
</p>

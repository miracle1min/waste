import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

function versionPlugin() {
  const version = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return {
    name: "version-json",
    buildStart() {
      const versionData = JSON.stringify({
        version,
        buildTime: new Date().toISOString(),
      });
      fs.mkdirSync(path.resolve(__dirname, "public"), { recursive: true });
      fs.writeFileSync(
        path.resolve(__dirname, "public/version.json"),
        versionData
      );
    },
    config() {
      return {
        define: {
          __APP_VERSION__: JSON.stringify(version),
        },
      };
    },
  };
}


function asyncCssPlugin() {
  return {
    name: "async-css",
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        (_match: string, p1: string) => {
          return `<link rel="stylesheet" href="${p1}" media="print" onload="this.media=&apos;all&apos;" /><noscript><link rel="stylesheet" href="${p1}" /></noscript>`;
        }
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), versionPlugin(), asyncCssPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: true,
    modulePreload: {
      // Only preload direct imports, skip heavy vendor chunks
      resolveDependencies: (filename: string, deps: string[], { hostId, hostType }: { hostId: string; hostType: "html" | "js"; }) => {
        // For HTML entry, only preload core chunks, not heavy ones
        return deps.filter(dep => 
          !dep.includes('jspdf') && 
          !dep.includes('autotable') &&
          !dep.includes('vendor-charts') && 
          !dep.includes('html2canvas')
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // jspdf: NOT in manualChunks - let Vite naturally code-split via dynamic import in pdf-download.tsx
          // Charts - only loaded by dashboard (lazy route)
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory')) {
            return 'vendor-charts';
          }
          // html2canvas - only used in pdf-download
          if (id.includes('node_modules/html2canvas')) {
            return 'html2canvas';
          }
          // Core UI components - needed by most pages
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-ui';
          }
          // React core - always needed
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          // Query lib
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-query';
          }
          // Utils
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge') || id.includes('node_modules/class-variance-authority') || id.includes('node_modules/zod')) {
            return 'vendor-utils';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});

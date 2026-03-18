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
          !dep.includes('vendor-pdf') && 
          !dep.includes('vendor-charts') && 
          !dep.includes('html2canvas')
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-label",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
            "@radix-ui/react-slot",
          ],
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-utils": ["date-fns", "clsx", "tailwind-merge", "class-variance-authority", "zod"],
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

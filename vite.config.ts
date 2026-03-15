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

export default defineConfig({
  plugins: [react(), versionPlugin()],
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

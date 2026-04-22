/// <reference types="vite/client" />

declare module "*.webp" {
  const src: string;
  export default src;
}

declare const __APP_VERSION__: string;

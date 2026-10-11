import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, Express (server/_core/index.ts, port 3100) mounts Vite as
// middleware, so the standalone Vite dev server below is only a fallback and
// is normally never started. `vite build` emits the client to dist/.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});

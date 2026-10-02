import { defineConfig } from "vite";

// Tauri serves the build from disk and the dev server on a fixed port, see src-tauri/tauri.conf.json.
export default defineConfig({
  clearScreen: false,
  server: { port: 5174, strictPort: true },
  build: { target: "es2023" },
});

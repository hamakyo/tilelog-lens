import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/tesseract.js")) return "ocr";
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/redux") ||
            id.includes("node_modules/@reduxjs")
          ) {
            return "charts";
          }
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom")
          ) {
            return "react";
          }
          return undefined;
        }
      }
    }
  },
  server: {
    host: "127.0.0.1"
  }
});

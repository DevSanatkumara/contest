import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [".."] },
  },
  resolve: {
    alias: {
      "@ckeditor/ckeditor5-react": path.resolve("node_modules/@ckeditor/ckeditor5-react"),
      "@ckeditor/ckeditor5-build-classic": path.resolve("node_modules/@ckeditor/ckeditor5-build-classic"),
    },
  },
});

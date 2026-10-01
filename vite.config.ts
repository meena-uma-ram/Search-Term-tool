import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = `http://localhost:${process.env.PORT ?? 3001}`;

export default defineConfig({
  root: "src/client",
  plugins: [react()],
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Everything that touches Google (OAuth + API) goes through the backend.
    // The browser never sees client secrets, developer tokens or OAuth tokens.
    proxy: {
      "^/api/": backend,
      "^/auth/": backend,
    },
  },
});

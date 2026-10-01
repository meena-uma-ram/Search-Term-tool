// Standalone preview build: the full UI with the demo provider running in the
// browser (no backend), packed into one HTML page by scripts/build-preview.mjs.
// React comes from cdnjs as UMD globals, so JSX is compiled to React.createElement.
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

const clientDir = path.resolve("src/client");
const standaloneApi = path.join(clientDir, "api.standalone.ts");

/** Point every import of src/client/api.ts at the standalone implementation. */
const swapApi = (): Plugin => ({
  name: "swap-api",
  enforce: "pre",
  resolveId(source, importer) {
    if (!importer || importer === standaloneApi || !/(^|\/)api$/.test(source)) return null;
    const target = path.resolve(path.dirname(importer), source);
    return target === path.join(clientDir, "api") ? standaloneApi : null;
  },
});

export default defineConfig({
  plugins: [swapApi()],
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    jsxInject: `import React from "react"`,
  },
  build: {
    outDir: "dist-preview",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.join(clientDir, "main.tsx"),
      formats: ["iife"],
      name: "SearchTermsCleaner",
      fileName: () => "app.js",
      cssFileName: "app",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react-dom/client"],
      output: { globals: { react: "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM" } },
    },
  },
});

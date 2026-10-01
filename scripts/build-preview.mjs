// Builds dist-preview/search-terms-cleaner.html: a self-contained page with the
// whole UI on synthetic demo data, for sharing without running a server.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

execSync("npx vite build --config vite.preview.config.ts", { stdio: "inherit" });

const js = readFileSync("dist-preview/app.js", "utf8").replace(/<\/script/gi, "<\\/script");
const css = readFileSync("dist-preview/app.css", "utf8").replace(/<\/style/gi, "<\\/style");

const html = `<title>Search Terms Cleaner</title>
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
writeFileSync("dist-preview/search-terms-cleaner.html", html);
console.log(`Wrote dist-preview/search-terms-cleaner.html (${(html.length / 1024).toFixed(1)} KB)`);

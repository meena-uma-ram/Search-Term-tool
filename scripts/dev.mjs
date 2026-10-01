// Runs the backend (tsx watch) and the Vite dev server side by side.
import { spawn } from "node:child_process";

const procs = [
  spawn("npm", ["run", "dev:server"], { stdio: "inherit" }),
  spawn("npm", ["run", "dev:client"], { stdio: "inherit" }),
];

const shutdown = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
procs.forEach((p) => p.on("exit", (code) => { if (code) { shutdown(); process.exit(code); } }));

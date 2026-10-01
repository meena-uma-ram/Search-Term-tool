// Runs the backend (tsx watch) and the Vite dev server side by side.
// Cross-platform: on Windows npm is npm.cmd and needs a shell to launch.
import { spawn } from "node:child_process";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 19) || (major === 22 && minor < 12)) {
  console.error(`Node ${process.versions.node} is too old. Please install Node 20.19+ or 22.12+ (https://nodejs.org).`);
  process.exit(1);
}

const isWindows = process.platform === "win32";
const run = (script) => spawn("npm", ["run", script], { stdio: "inherit", shell: isWindows });
const procs = [run("dev:server"), run("dev:client")];

const shutdown = () => procs.forEach((p) => p.kill());
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
procs.forEach((p) =>
  p.on("exit", (code) => {
    if (code) {
      shutdown();
      process.exit(code);
    }
  }),
);

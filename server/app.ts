import { existsSync } from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import type { ServerConfig } from "./config";
import { apiRouter } from "./routes/api";
import { authRouter } from "./routes/auth";
import { MemorySessionStore, sessionMiddleware } from "./session";

export interface AppOptions {
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
  store?: MemorySessionStore;
  staticDir?: string;
}

export function createApp(config: ServerConfig, opts: AppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (config.production) app.set("trust proxy", 1);

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  app.use(sessionMiddleware({ secret: config.sessionSecret, secure: config.production, store: opts.store }));

  app.use("/auth", authRouter(config, opts.fetch));
  app.use(
    "/api",
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
    apiRouter(config, opts.fetch),
  );

  // Production: serve the built frontend.
  const staticDir = opts.staticDir ?? path.resolve("dist");
  if (existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: "index.html" }));
    app.get(/^\/(?!api\/|auth\/).*/, (_req, res) => res.sendFile(path.join(staticDir, "index.html")));
  }

  return app;
}

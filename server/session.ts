import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Minimal server-side session store. The browser only gets an opaque, signed,
 * HttpOnly session id; OAuth tokens stay in server memory.
 *
 * MVP note: memory storage means sessions are lost on restart and do not work
 * across multiple server instances. For production, swap MemorySessionStore
 * for a persistent store (e.g. Redis/Postgres) and encrypt refresh tokens at rest.
 */
export interface GoogleTokens {
  accessToken: string;
  /** epoch ms */
  expiresAt: number;
  refreshToken: string;
}

export interface SessionData {
  oauthState?: string;
  google?: GoogleTokens;
  /** accountId -> login-customer-id to use (null = direct access). */
  accountAccess?: Record<string, string | null>;
}

interface Entry {
  data: SessionData;
  expiresAt: number;
}

const COOKIE = "stc_sid";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class MemorySessionStore {
  private entries = new Map<string, Entry>();

  get(id: string): SessionData | undefined {
    const e = this.entries.get(id);
    if (!e) return undefined;
    if (e.expiresAt < Date.now()) {
      this.entries.delete(id);
      return undefined;
    }
    return e.data;
  }

  set(id: string, data: SessionData) {
    this.entries.set(id, { data, expiresAt: Date.now() + TTL_MS });
  }

  delete(id: string) {
    this.entries.delete(id);
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session: SessionData;
      /** Replace the session id (call after login to prevent session fixation). */
      regenerateSession: () => void;
      destroySession: () => void;
    }
  }
}

function sign(id: string, secret: string) {
  return createHmac("sha256", secret).update(id).digest("base64url");
}

function verify(cookieValue: string, secret: string): string | null {
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const given = Buffer.from(cookieValue.slice(dot + 1));
  const expected = Buffer.from(sign(id, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function sessionMiddleware(opts: { secret: string; secure: boolean; store?: MemorySessionStore }) {
  const store = opts.store ?? new MemorySessionStore();

  const setCookie = (res: Response, id: string) =>
    res.cookie(COOKIE, `${id}.${sign(id, opts.secret)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: opts.secure,
      maxAge: TTL_MS,
      path: "/",
    });

  return (req: Request, res: Response, next: NextFunction) => {
    const raw = readCookie(req, COOKIE);
    let id = raw ? verify(raw, opts.secret) : null;
    let data = id ? store.get(id) : undefined;
    if (!id || !data) {
      id = randomBytes(32).toString("base64url");
      data = {};
    }
    req.session = data;

    let currentId = id;
    let destroyed = false;
    req.regenerateSession = () => {
      store.delete(currentId);
      currentId = randomBytes(32).toString("base64url");
    };
    req.destroySession = () => {
      store.delete(currentId);
      destroyed = true;
    };

    // Persist before headers go out. Only issue a cookie once there is something to keep.
    const writeHead = res.writeHead;
    res.writeHead = function (this: Response, ...args: Parameters<typeof writeHead>) {
      if (destroyed) {
        res.clearCookie(COOKIE, { path: "/" });
      } else if (Object.keys(req.session).length > 0) {
        store.set(currentId, req.session);
        if (currentId !== raw?.slice(0, raw.lastIndexOf("."))) setCookie(res, currentId);
      }
      return writeHead.apply(this, args);
    } as typeof writeHead;

    next();
  };
}

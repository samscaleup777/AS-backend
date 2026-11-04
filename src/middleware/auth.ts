import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthUser = { id: string; email: string; name: string; role: "admin" | "user" };
declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  const base = (process.env.AUTH_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  jwks ??= createRemoteJWKSet(new URL(`${base}/api/auth/jwks`));
  return { keys: jwks, base };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.better_auth_jwt || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Authentication required." });

  try {
    const { keys, base } = getJwks();
    const { payload } = await jwtVerify(token, keys, { issuer: base, audience: base });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    const id = typeof payload.sub === "string" ? payload.sub : "";
    if (!id || !email) {
      return res.status(401).json({ message: "The session token is missing required identity claims." });
    }
    req.user = {
      id,
      email,
      name: typeof payload.name === "string" ? payload.name : (email.split("@")[0] ?? email),
      role: payload.role === "admin" ? "admin" : "user",
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Session is invalid or expired. Please sign in again." });
  }
}

/** Admin access is granted only when both the signed role claim and this API's
 * independently configured email allowlist agree. Missing configuration denies access. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const allowedEmails = new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!req.user || req.user.role !== "admin" || !allowedEmails.has(req.user.email.toLowerCase())) {
    return res.status(403).json({ message: "Administrator access is required." });
  }
  return next();
}

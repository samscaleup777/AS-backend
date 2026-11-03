import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthUser = { id: string; email: string; name: string };
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
      name: typeof payload.name === "string" ? payload.name : email.split("@")[0],
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Session is invalid or expired. Please sign in again." });
  }
}
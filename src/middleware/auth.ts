import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getDb } from "../lib/db.js";

export type AuthUser = { id: string; email: string; name: string; role: "admin" | "user"; twoFactorEnabled: boolean };
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
    if (!id || !email) return res.status(401).json({ message: "The session token is missing required identity claims." });

    // Enforce 2FA from both the signed access token and the persisted Better Auth user record.
    // This prevents a client-side redirect from being the only security boundary.
    if (payload.twoFactorEnabled !== true) {
      return res.status(403).json({ code: "TWO_FACTOR_REQUIRED", message: "Set up two-factor authentication before using StudioSpace." });
    }
    const db = await getDb();
    const account = await db.collection("user").findOne(
      { _id: id },
      { projection: { twoFactorEnabled: 1, adminAccessDisabled: 1 } },
    );
    if (!account || account.twoFactorEnabled !== true) {
      return res.status(403).json({ code: "TWO_FACTOR_REQUIRED", message: "Set up two-factor authentication before using StudioSpace." });
    }
    if (account.adminAccessDisabled === true) {
      return res.status(403).json({ code: "ACCOUNT_SUSPENDED", message: "This account has been temporarily restricted. Contact StudioSpace support." });
    }

    req.user = {
      id,
      email,
      name: typeof payload.name === "string" ? payload.name : (email.split("@")[0] ?? email),
      role: payload.role === "admin" ? "admin" : "user",
      twoFactorEnabled: true,
    };
    return next();
  } catch (error) {
    if (error instanceof Error && error.message.includes("MONGODB_URI")) return next(error);
    return res.status(401).json({ message: "Session is invalid or expired. Please sign in again." });
  }
}

/** Admin access requires a signed role claim, API-side email allowlist, and persisted admin password marker. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const allowedEmails = new Set(
    (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  if (!req.user || req.user.role !== "admin" || !allowedEmails.has(req.user.email.toLowerCase())) {
    return res.status(403).json({ message: "Administrator access is required." });
  }
  try {
    const db = await getDb();
    const adminRecord = await db.collection("user").findOne(
      { _id: req.user.id, email: req.user.email.toLowerCase() },
      { projection: { adminPasswordVerified: 1, twoFactorEnabled: 1, adminAccessDisabled: 1 } },
    );
    if (adminRecord?.adminPasswordVerified !== true || adminRecord?.twoFactorEnabled !== true || adminRecord?.adminAccessDisabled === true) {
      return res.status(403).json({ message: "Administrator security verification is required." });
    }
    return next();
  } catch (error) { return next(error); }
}

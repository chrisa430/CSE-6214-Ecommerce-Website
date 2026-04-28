/**
 * @fileoverview JWT auth guard — Node.js built-in crypto only, no npm deps.
 * @module middleware/authGuard.ts
 * @author Darrell Hobson
 * @Date 2026.04.24
 */
import { createHmac, timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";

export interface TokenPayload {
  sub:   string;
  email: string;
  type:  "admin" | "buyer" | "seller";
  iat?:  number;
  exp?:  number;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me";

function base64urlSign(data: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad  = (4 - (b64.length % 4)) % 4;
  return Buffer.from(b64 + "=".repeat(pad), "base64").toString("utf8");
}

function verifyJwt(token: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const [headerB64, payloadB64, sigB64] = parts;

  // Verify signature — compare two base64url strings as equal-length ASCII buffers
  const expectedSig = base64urlSign(`${headerB64}.${payloadB64}`, ACCESS_SECRET);

  // Normalise: strip any trailing = padding, ensure same length before timingSafeEqual
  const a = Buffer.from(sigB64.replace(/=/g, ""),      "ascii");
  const b = Buffer.from(expectedSig.replace(/=/g, ""), "ascii");

  if (a.length !== b.length) throw new Error("Signature mismatch");
  if (!timingSafeEqual(a, b))  throw new Error("Signature mismatch");

  // Decode payload (header not needed after sig check)
  const payload = JSON.parse(base64urlDecode(payloadB64)) as TokenPayload & { exp?: number };

  if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error("Token expired");

  return payload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }
  try {
    const payload  = verifyJwt(authHeader.slice(7));
    (req as any).user = payload;
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid token";
    res.status(401).json({ error: `Unauthorized: ${msg}` });
  }
}

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface TokenPayload {
  sub: string; email: string; type: "admin" | "buyer" | "seller";
  iat?: number; exp?: number;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" }); return;
  }
  try {
    const payload = jwt.verify(header.slice(7), ACCESS_SECRET) as TokenPayload;
    (req as any).user = payload;
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid token";
    res.status(401).json({ error: `Unauthorized: ${msg}` });
  }
}

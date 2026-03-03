/**
 * @fileoverview Express middleware that protects authenticated routes
 * @module authGuard.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./jwt";
import { logger } from "../logger";

/**
 * Acquires a client
 *
 * @returns Promise<void>
 * @remarks
 * - reads the Authorization header
 * - validates the Bearer prefix
 * - extracts the token
 * - calls verifyAccessToken()
 * - attaches the decoded payload to req.user
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch (err) {
    logger.warn("Invalid access token", { err });
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}

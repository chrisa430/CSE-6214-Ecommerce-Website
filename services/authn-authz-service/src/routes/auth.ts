/**
 * @fileoverview Three route handlers
 * @module auth.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
// fetch is available globally in Node 18+ — no import needed
import {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  refreshExpiryDate,
  verifyRefreshToken,
} from "../middleware/jwt";
import { writeAuthAuditLog } from "../db/auditLog";
import { publishEvent, TOPICS } from "../kafka/client";
import { logger } from "../logger";

const router = Router();

// ── Validation helpers ──────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password rules:
 *  - 12+ chars
 *  - ≥1 uppercase letter
 *  - ≥1 lowercase letter
 *  - ≥1 digit
 *  - ≥1 special char from: * $ ! - @
 */
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[*$!\-@]).{12,}$/;

/**
 *
 * @param email
 * @param password
 * @returns string
 * @remarks
 * -
 */
function validateCredentials(
    email: string,
    password: string
): string | null {
  if (!email || !EMAIL_RE.test(email))       return "A valid email address is required.";
  if (!password || !PASSWORD_RE.test(password))
    return "Password must be ≥12 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character (* $ ! - @).";
  return null;
}

// ── Helper: lookup account from AccountService ──────────────────────────────

/**
 *
 * @param email
 * @returns Promise<{
 *   id: string;
 *   passwordHash: string;
 *   firstName: string;
 *   lastName: string;
 *   type: string;
 *   status: string;} | null>
 * @remarks
 * -
 */
async function fetchAccountByEmail(email: string): Promise<{
  id: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  type: string;
  status: string;
} | null> {
  const url = `${process.env.ACCOUNT_SERVICE_URL || "http://localhost:3002"}/internal/accounts/by-email/${encodeURIComponent(email)}`;
  try {
    const res = await fetch(url, {
      headers: { "x-internal-secret": process.env.INTERNAL_SECRET || "internal-secret" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`AccountService responded ${res.status}`);
    return (await res.json()) as {
      id: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
      type: string;
      status: string;
    };
  } catch (err) {
    logger.error("Error reaching AccountService", err);
    throw err;
  }
}

/**
 * POST /auth/login
 *
 * @returns Promise<void>
 * @remarks
 * - Server-side validation with validateCredentials()
 * - fetchAccountByEmail() makes HTTP GET to AccountService's internal endpoint with x-internal-secret header
 * - Status check — returns HTTP 403 if account is suspended or closed
 * - bcrypt.compare(plaintext, hash) — constant-time comparison prevents timing attacks
 * - Failed attempt: writes failed audit log
 * - Success: signs access + refresh tokens
 *
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  const ip        = req.ip ?? "unknown";
  const userAgent = req.headers["user-agent"] ?? "unknown";

  // Basic input validation
  const validationError = validateCredentials(email ?? "", password ?? "");
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  try {
    // Fetch account credentials from AccountService
    const account = await fetchAccountByEmail(email!);

    if (!account) {
      await writeAuthAuditLog({
        accountId: "00000000-0000-0000-0000-000000000000",
        action: "LOGIN",
        ipAddress: ip,
        userAgent,
        success: false,
        detail: `No account found for ${email}`,
      });
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (account.status !== "active") {
      res.status(403).json({ error: `Account is ${account.status}` });
      return;
    }

    // Compare password
    const match = await bcrypt.compare(password!, account.passwordHash);

    if (!match) {
      await writeAuthAuditLog({
        accountId: account.id,
        action: "LOGIN",
        ipAddress: ip,
        userAgent,
        success: false,
        detail: "Password mismatch",
      });
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Build token payload
    const payload = {
      sub:   account.id,
      email: email!,
      type:  account.type,
    };

    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Persist refresh token (hashed)
    await storeRefreshToken(account.id, refreshToken, refreshExpiryDate());

    // Audit log – success
    await writeAuthAuditLog({
      accountId: account.id,
      action:    "LOGIN",
      ipAddress: ip,
      userAgent,
      success:   true,
    });

    // Publish Kafka event
    await publishEvent(TOPICS.AUTH_EVENTS, account.id, {
      eventType:  "USER_LOGIN",
      accountId:  account.id,
      email:      email,
      occurredAt: new Date().toISOString(),
    });

    logger.info(`User logged in: ${email}`);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id:        account.id,
        email:     email,
        firstName: account.firstName,
        lastName:  account.lastName,
        type:      account.type,
      },
    });
  } catch (err) {
    logger.error("Login error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /auth/refresh
 *
 * @returns Promise<void>
 * @remarks
 * - Accepts a refresh token, calls verifyRefreshToken()
 */
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }

  try {
    const payload      = verifyRefreshToken(refreshToken);
    const newAccess    = signAccessToken({
      sub:   payload.sub,
      email: payload.email,
      type:  payload.type,
    });
    res.json({ accessToken: newAccess });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

/**
 * POST /auth/logout
 *
 * @returns Promise<void>
 * @remarks
 * - Accepts accountId, calls revokeRefreshToken()
 */
router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  const { accountId } = req.body as { accountId?: string };
  if (!accountId) {
    res.status(400).json({ error: "accountId is required" });
    return;
  }

  try {
    await revokeRefreshToken(accountId);

    await writeAuthAuditLog({
      accountId,
      action:    "LOGOUT",
      ipAddress: req.ip ?? undefined,
      userAgent: req.headers["user-agent"],
      success:   true,
    });

    await publishEvent(TOPICS.AUTH_EVENTS, accountId, {
      eventType:  "USER_LOGOUT",
      accountId,
      occurredAt: new Date().toISOString(),
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    logger.error("Logout error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

// ── POST /auth/internal/seed ──────────────────────────────────────────────────
// Verifies authn_authz DB is reachable; reports refresh_token counts.
router.post("/internal/seed", async (req: Request, res: Response): Promise<void> => {
  const secret = req.headers["x-internal-secret"];
  if (secret !== (process.env.INTERNAL_SECRET || "internal-secret")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  try {
    const { getPool: getAuthPool } = await import("../db/pool");
    const pool = getAuthPool();
    const tokens = (await pool.query("SELECT COUNT(*) FROM refresh_tokens")).rows[0].count;
    res.json({ service: "AuthnAuthzService", refresh_tokens: parseInt(tokens), message: "Auth DB verified" });
  } catch (err) {
    logger.error("Seed error", err);
    res.status(500).json({ error: "Seed check failed", detail: String(err) });
  }
});


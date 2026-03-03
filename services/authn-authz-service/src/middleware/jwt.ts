/**
 * @fileoverview All JWT logic in one module
 * @module jwt.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { getPool } from "../db/pool";
import { logger } from "../logger";

export interface TokenPayload {
  sub: string;    // account ID (UUID)
  email: string;
  type: string;   // account type: admin | buyer | seller
  iat?: number;
  exp?: number;
}

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || "dev_access_secret_change_me";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_me";
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * Calls jwt.sign with ACCESS_SECRET
 *
 * @returns string
 * @remarks
 * -
 */
export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

/**
 * Calls jwt.sign with REFRESH_SECRET
 *
 * @returns string
 * @remarks
 * -
 */
export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions);
}

/**
 * Calls jwt.verify to verify ACCESS_SECRET
 *
 * @returns TokenPayload
 * @remarks
 * -
 */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

/**
 * Calls jwt.verify to verify REFRESH_SECRET
 *
 * @returns TokenPayload
 * @remarks
 * -
 */
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}

/**
 * Persist refresh token
 *
 * @param accountId
 * @param rawToken
 * @param expiresAt
 * @returns Promise<void>
 * @remarks
 * - bcrypt-hashes the raw token at 10 rounds before persisting to the DB
 */
export async function storeRefreshToken(
  accountId: string,
  rawToken: string,
  expiresAt: Date
): Promise<void> {
  const tokenHash = await bcrypt.hash(rawToken, 10);
  await getPool().query(
    `INSERT INTO refresh_tokens (account_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [accountId, tokenHash, expiresAt]
  );
}

/**
 * Revoke a refresh token
 *
 * @param accountId
 * @returns Promise<void>
 * @remarks
 * - sets revoked=TRUE for all active tokens for an account
 */
export async function revokeRefreshToken(accountId: string): Promise<void> {
  await getPool().query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE account_id = $1 AND revoked = FALSE`,
    [accountId]
  );
}

/**
 * Refresh-token expiry helper
 *
 * @returns Data
 * @remarks
 * - returns the Date 7 days from now, matching the JWT 7d expiry
 */
export function refreshExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);   // matches "7d"
  return d;
}

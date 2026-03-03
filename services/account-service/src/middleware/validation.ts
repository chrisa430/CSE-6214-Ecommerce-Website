/**
 * @fileoverview Express middleware that validates the registration body
 * @module validation.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import { Request, Response, NextFunction } from "express";

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[*$!\-@]).{12,}$/;

const VALID_TYPES = new Set(["admin", "buyer", "seller"]);

export interface RegisterBody {
  userId:      string;
  password:    string;
  firstName:   string;
  lastName:    string;
  accountType: string;
}

/**
 * Accumulates all errors into a Record<string,string> before responding
 *
 * @param req
 * @param res
 * @param nextFunction
 * @returns void
 * @remarks
 * -
 */
export function validateRegistration(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { userId, password, firstName, lastName, accountType } = req.body as Partial<RegisterBody>;

  const errors: Record<string, string> = {};

  if (!userId || !EMAIL_RE.test(userId)) {
    errors.userId = "A valid email address is required.";
  }

  if (!password || !PASSWORD_RE.test(password)) {
    errors.password =
      "Password must be ≥12 characters and include at least one uppercase letter, " +
      "one lowercase letter, one digit, and one special character (* $ ! - @).";
  }

  if (!firstName || firstName.trim().length === 0) {
    errors.firstName = "First name is required.";
  }

  if (!lastName || lastName.trim().length === 0) {
    errors.lastName = "Last name is required.";
  }

  if (!accountType || !VALID_TYPES.has(accountType)) {
    errors.accountType = "Account type must be one of: admin, buyer, seller.";
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  next();
}

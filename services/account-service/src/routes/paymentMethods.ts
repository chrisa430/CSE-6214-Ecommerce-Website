/**
 * @fileoverview Payment method routes — mounted at /accounts/:id/payment-methods
 * @module routes/paymentMethods.ts
 */
import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getPool } from "../db/pool";
import { logger }  from "../logger";

const router = Router({ mergeParams: true });
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me";

function getUser(req: Request): { sub: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), ACCESS_SECRET) as { sub: string }; } catch { return null; }
}

function ownAccountGuard(req: Request, res: Response): boolean {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return false; }
  if (user.sub !== req.params.id) {
    res.status(403).json({ error: "You can only modify your own account" }); return false;
  }
  return true;
}

// GET /accounts/:id/payment-methods
router.get("/", async (req: Request, res: Response): Promise<void> => {
  if (!ownAccountGuard(req, res)) return;
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT pm.id, pmt.name AS type, pm.nickname,
              pm.card_number AS "cardNumber",
              pm.exp_month AS "expMonth", pm.exp_year AS "expYear"
       FROM payment_method pm
       JOIN payment_method_type pmt ON pmt.id = pm.type
       WHERE pm.account_id = $1 ORDER BY pm.id`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error("Get payment methods error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/:id/payment-methods
router.post("/", async (req: Request, res: Response): Promise<void> => {
  if (!ownAccountGuard(req, res)) return;
  const { type, nickname, cardNumber, expMonth, expYear } = req.body as {
    type: string; nickname?: string; cardNumber: string; expMonth: number; expYear: number;
  };
  const pool = getPool();
  try {
    const typeRow = await pool.query("SELECT id FROM payment_method_type WHERE name=$1", [type]);
    if (!typeRow.rowCount) { res.status(400).json({ error: "Invalid payment type" }); return; }
    const last4 = String(cardNumber).replace(/\D/g,"").slice(-4);
    const result = await pool.query(
      `INSERT INTO payment_method (account_id,type,nickname,card_number,exp_month,exp_year)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.params.id, typeRow.rows[0].id, nickname||null, last4, expMonth, expYear]
    );
    res.status(201).json({ id: result.rows[0].id, message: "Payment method added" });
  } catch (err: any) {
    if (err.message?.includes("at most 2 payment methods")) {
      res.status(400).json({ error: "You can only have up to 2 payment methods." }); return;
    }
    logger.error("Add payment method error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /accounts/:id/payment-methods/:pmId
router.put("/:pmId", async (req: Request, res: Response): Promise<void> => {
  if (!ownAccountGuard(req, res)) return;
  const { nickname } = req.body as { nickname?: string };
  const pool = getPool();
  try {
    const r = await pool.query(
      "UPDATE payment_method SET nickname=COALESCE($1,nickname) WHERE id=$2 AND account_id=$3 RETURNING id",
      [nickname||null, req.params.pmId, req.params.id]
    );
    if (!r.rowCount) { res.status(404).json({ error: "Payment method not found" }); return; }
    res.json({ message: "Payment method updated" });
  } catch (err) {
    logger.error("Update payment method error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /accounts/:id/payment-methods/:pmId
router.delete("/:pmId", async (req: Request, res: Response): Promise<void> => {
  if (!ownAccountGuard(req, res)) return;
  const pool = getPool();
  try {
    const r = await pool.query(
      "DELETE FROM payment_method WHERE id=$1 AND account_id=$2 RETURNING id",
      [req.params.pmId, req.params.id]
    );
    if (!r.rowCount) { res.status(404).json({ error: "Payment method not found" }); return; }
    res.json({ message: "Payment method removed" });
  } catch (err) {
    logger.error("Delete payment method error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

/**
 * @fileoverview Profile picture routes — mounted at /accounts/:id/profile-picture
 * @module routes/profilePicture.ts
 */
import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { getPool } from "../db/pool";
import { logger }  from "../logger";

const router  = Router({ mergeParams: true });
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me";

// Inline type to avoid relying on Express.Multer global augmentation
interface UploadedFile {
  buffer:   Buffer;
  mimetype: string;
  size:     number;
}

function getUser(req: Request): { sub: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), ACCESS_SECRET) as { sub: string }; } catch { return null; }
}

function ownAccountGuard(req: Request, res: Response): boolean {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return false; }
  if (user.sub !== (req.params as Record<string, string>).id) {
    res.status(403).json({ error: "You can only modify your own account" }); return false;
  }
  return true;
}

// GET /accounts/:id/profile-picture
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const r = await pool.query(
      "SELECT profile_picture AS data, profile_picture_mime AS mime FROM account WHERE id=$1",
      [(req.params as Record<string, string>).id]
    );
    if (!r.rowCount || !r.rows[0].data) { res.status(404).json({ error: "No profile picture" }); return; }
    res.json({ data: r.rows[0].data, mime: r.rows[0].mime });
  } catch (err) {
    logger.error("Get profile picture error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /accounts/:id/profile-picture
router.post("/", (req: Request, res: Response): void => {
  if (!ownAccountGuard(req, res)) return;
  const id = (req.params as Record<string, string>).id;

  upload.single("picture")(req as any, res as any, async (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload error";
      res.status(400).json({ error: msg });
      return;
    }
    const file = (req as unknown as { file?: UploadedFile }).file;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const pool = getPool();
    try {
      const b64  = file.buffer.toString("base64");
      const mime = file.mimetype;
      await pool.query(
        "UPDATE account SET profile_picture=$1, profile_picture_mime=$2 WHERE id=$3",
        [b64, mime, id]
      );
      res.json({ message: "Profile picture updated", data: b64, mime });
    } catch (dbErr) {
      logger.error("Upload profile picture error", dbErr);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /accounts/:id/profile-picture
router.delete("/", async (req: Request, res: Response): Promise<void> => {
  if (!ownAccountGuard(req, res)) return;
  const pool = getPool();
  try {
    await pool.query(
      "UPDATE account SET profile_picture=NULL, profile_picture_mime=NULL WHERE id=$1",
      [(req.params as Record<string, string>).id]
    );
    res.json({ message: "Profile picture removed" });
  } catch (err) {
    logger.error("Delete profile picture error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

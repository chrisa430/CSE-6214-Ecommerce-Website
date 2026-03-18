import { Request, Response, NextFunction } from "express";

export function requireRole(role: "buyer" | "seller" | "admin") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user || user.type !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
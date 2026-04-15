import { Request, Response, NextFunction } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user || !roles.includes(user.type)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}

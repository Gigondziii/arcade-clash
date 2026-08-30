import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import {
  type AdminRole,
  type AdminPermission,
  ROLE_PERMISSIONS,
  ALL_ADMIN_PERMISSIONS,
  hasPermission,
  PERMISSION_ALIAS_MAP,
} from "@fugluck/shared";

export type { AdminRole, AdminPermission };
export { ROLE_PERMISSIONS, ALL_ADMIN_PERMISSIONS, hasPermission, PERMISSION_ALIAS_MAP };

export function requirePermission(permission: AdminPermission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
    if (!user || user.status === "banned" || user.status === "suspended") {
      res.status(403).json({ error: "Account access restricted." });
      return;
    }

    if (!hasPermission(user.role, permission)) {
      res.status(403).json({ error: `Forbidden: Missing required permission [${permission}].` });
      return;
    }

    next();
  };
}

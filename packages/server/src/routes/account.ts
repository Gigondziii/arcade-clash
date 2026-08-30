import { eq } from "drizzle-orm";
import { Router } from "express";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../auth/password";
import { attachSession, requireAuth } from "../auth/middleware";
import { db } from "../db/client";
import { users } from "../db/schema";
import { createRateLimiterMiddleware } from "../utils/rateLimiter";

const passwordChangeLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: "Too many password change attempts. Please wait 15 minutes.",
});

export const accountRouter = Router();

accountRouter.use(attachSession, requireAuth);

accountRouter.post("/change-password", passwordChangeLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (
    typeof currentPassword !== "string" ||
    !currentPassword ||
    typeof newPassword !== "string" ||
    !newPassword
  ) {
    res.status(400).json({ error: "Current password and new password are required." });
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId!) });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account access restricted." });
    return;
  }

  const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    res.status(400).json({ error: "Incorrect current password." });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: "New password must be different from current password." });
    return;
  }

  const policyResult = validatePasswordPolicy(newPassword);
  if (!policyResult.valid) {
    res.status(400).json({ error: policyResult.error });
    return;
  }

  const newPasswordHash = await hashPassword(newPassword);

  await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, user.id));

  res.json({
    success: true,
    message: "Password updated successfully.",
  });
});

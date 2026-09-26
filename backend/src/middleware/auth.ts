import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "./errorHandler";

/**
 * Requires a valid access token in the Authorization: Bearer header.
 * This runs on EVERY protected route — role hiding in the frontend alone
 * is explicitly not acceptable per spec, so this is the real gate.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError("Missing or invalid Authorization header", 401);
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }
}

/**
 * Restricts a route to specific roles. Must run after requireAuth.
 * A Developer holding a modified/forged token still can't pass this check
 * for PM/Admin-only routes, and per-resource ownership checks (see
 * project.controller / task.controller) stop a Developer or PM from
 * reaching another user's data even for routes all roles can call.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError("Not authenticated", 401);
    if (!roles.includes(req.user.role)) {
      throw new AppError("Forbidden: insufficient role", 403);
    }
    next();
  };
}

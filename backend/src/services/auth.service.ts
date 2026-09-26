import bcrypt from "bcrypt";
import { prisma } from "../config/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { AppError } from "../middleware/errorHandler";
import { env } from "../config/env";

export const REFRESH_COOKIE_NAME = "refresh_token";

export const refreshCookieOptions = {
  httpOnly: true, // not readable from JS — mitigates XSS token theft
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth", // scoped narrowly to the refresh/logout endpoints
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("Invalid credentials", 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Invalid credentials", 401);

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });
  const refreshToken = signRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError("User no longer exists", 401);

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  return { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

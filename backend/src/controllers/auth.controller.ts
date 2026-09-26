import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import { login, refreshAccessToken, REFRESH_COOKIE_NAME, refreshCookieOptions } from "../services/auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("Invalid request body", 422, parsed.error.flatten());

  const { accessToken, refreshToken, user } = await login(parsed.data.email, parsed.data.password);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
  res.json({ accessToken, user });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw new AppError("No refresh token provided", 401);

  const { accessToken, user } = await refreshAccessToken(token);
  res.json({ accessToken, user });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
  res.status(204).send();
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

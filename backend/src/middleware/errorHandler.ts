import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Wrap async route handlers so thrown/rejected errors reach errorHandler
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        details: err.details ?? undefined,
      },
    });
  }

  // Never leak raw stack traces to the client
  console.error(err);
  return res.status(500).json({
    error: {
      message: "Internal server error",
      details: env.NODE_ENV === "development" ? String(err) : undefined,
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: "Route not found" } });
}

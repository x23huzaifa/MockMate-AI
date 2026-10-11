/**
 * Wraps async Express route handlers. Unexpected errors are logged
 * server-side and mapped to a generic 500 JSON response — never leaked
 * to the client (no stack traces, no SQL, no secrets).
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRoute = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err: unknown) => {
      console.error("[api] Unhandled route error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
  };
}

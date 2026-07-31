import { Request, Response, NextFunction } from 'express';

// 4-arg signature is what makes Express treat this as the error handler.
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err.stack);
  res.status(500).json({ error: 'internal server error' });
}

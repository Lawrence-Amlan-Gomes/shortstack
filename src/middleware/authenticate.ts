import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedRequest extends Request {
  userId?: number;
  /** Named tenantApp, not app — avoids clashing with Express's own req.app */
  tenantApp?: string;
}

/** Strict auth guard — 401s on missing/invalid/expired token. Currently unused; kept for a future route that should genuinely require login. */
export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing or malformed authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; app: string };
    req.userId = payload.userId;
    req.tenantApp = payload.app;
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

/** Never blocks — attaches userId/tenantApp if a valid token is present, otherwise passes through anonymous. Used on POST /api/links. */
export function optionalAuthenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; app: string };
    req.userId = payload.userId;
    req.tenantApp = payload.app;
  } catch {
    // Invalid token on an optional route is not an error — treat as anonymous.
  }
  next();
}

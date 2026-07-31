import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db/pool';

export const authRouter = Router();

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const JWT_SECRET = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return process.env.JWT_SECRET;
};

// SHA-256, not bcrypt: the input is already random and unguessable, not a human-chosen
// secret, so a slow hash buys nothing here.
function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function issueRefreshToken(userId: number): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
  return rawToken; // only moment the raw token exists — caller must return it to the client now
}

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  app: z.string().min(1),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  app: z.string().min(1),
});

authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password, app } = parsed.data;

  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND app = $2',
    [email, app]
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'email already registered for this app' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query<{ id: number; email: string }>(
    'INSERT INTO users (email, app, password_hash) VALUES ($1, $2, $3) RETURNING id, email',
    [email, app, passwordHash]
  );

  const user = result.rows[0];
  const token = jwt.sign({ userId: user.id, app }, JWT_SECRET(), { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = await issueRefreshToken(user.id);
  res.status(201).json({ token, refreshToken, user: { id: user.id, email: user.email, app } });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password, app } = parsed.data;

  const result = await pool.query<{ id: number; email: string; password_hash: string }>(
    'SELECT id, email, password_hash FROM users WHERE email = $1 AND app = $2',
    [email, app]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }

  const token = jwt.sign({ userId: user.id, app }, JWT_SECRET(), { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = await issueRefreshToken(user.id);
  res.json({ token, refreshToken, user: { id: user.id, email: user.email, app } });
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const parsed = RefreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { refreshToken } = parsed.data;
  const tokenHash = hashRefreshToken(refreshToken);

  const result = await pool.query<{ id: number; user_id: number; app: string; expires_at: Date; revoked_at: Date | null }>(
    `SELECT rt.id, rt.user_id, u.app, rt.expires_at, rt.revoked_at
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'invalid refresh token' });
    return;
  }

  const stored = result.rows[0];

  if (stored.revoked_at !== null) {
    // Reuse of an already-rotated token is a theft signal, not a normal retry.
    res.status(401).json({ error: 'refresh token already used' });
    return;
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    res.status(401).json({ error: 'refresh token expired' });
    return;
  }

  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [stored.id]);

  const newAccessToken = jwt.sign({ userId: stored.user_id, app: stored.app }, JWT_SECRET(), { expiresIn: ACCESS_TOKEN_EXPIRY });
  const newRefreshToken = await issueRefreshToken(stored.user_id);

  res.json({ token: newAccessToken, refreshToken: newRefreshToken });
});

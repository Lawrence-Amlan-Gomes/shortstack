import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool';

export const authRouter = Router();

const JWT_SECRET = () => process.env.JWT_SECRET ?? 'dev-secret';

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
  const token = jwt.sign({ userId: user.id, app }, JWT_SECRET(), { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: user.id, email: user.email, app } });
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

  const token = jwt.sign({ userId: user.id, app }, JWT_SECRET(), { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, app } });
});

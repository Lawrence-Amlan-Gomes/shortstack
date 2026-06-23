import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { linkRouter } from './routes/links';
import { authRouter } from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { pool } from './db/pool';
import { redis } from './redis/client';

export const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL ?? '*',
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/:slug', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;

  const cached = await redis.get(`slug:${slug}`);
  if (cached) {
    await pool.query('INSERT INTO clicks (slug) VALUES ($1)', [slug]);
    res.setHeader('X-Cache', 'HIT');
    res.redirect(301, cached);
    return;
  }

  const result = await pool.query<{ url: string }>(
    'SELECT url FROM links WHERE slug = $1',
    [slug]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'link not found' });
    return;
  }

  const url = result.rows[0].url;
  await redis.set(`slug:${slug}`, url, 'EX', 86400);
  await pool.query('INSERT INTO clicks (slug) VALUES ($1)', [slug]);
  res.setHeader('X-Cache', 'MISS');
  res.redirect(301, url);
});

app.use('/api/links', linkRouter);
app.use('/api/auth', authRouter);

app.use(errorHandler);

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { linkRouter } from './routes/links';
import { authRouter } from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { pool } from './db/pool';

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
  const result = await pool.query<{ url: string }>(
    'SELECT url FROM links WHERE slug = $1',
    [slug]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'link not found' });
    return;
  }
  await pool.query('INSERT INTO clicks (slug) VALUES ($1)', [slug]);
  res.redirect(301, result.rows[0].url);
});

app.use('/api/links', linkRouter);
app.use('/api/auth', authRouter);

app.use(errorHandler);

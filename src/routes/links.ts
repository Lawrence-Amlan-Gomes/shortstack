import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';

export const linkRouter = Router();

const CreateLinkSchema = z.object({
  url: z.string().url(),
});

linkRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { url } = parsed.data;
  const slug = Math.random().toString(36).slice(2, 8);

  const result = await pool.query<{ slug: string }>(
    'INSERT INTO links (slug, url) VALUES ($1, $2) RETURNING slug',
    [slug, url]
  );

  const { slug: savedSlug } = result.rows[0];
  const base = process.env.BASE_URL ?? 'http://localhost:3000';
  res.status(201).json({ slug: savedSlug, short: `${base}/${savedSlug}` });
});

linkRouter.get('/:slug', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;

  const result = await pool.query<{ url: string }>(
    'SELECT url FROM links WHERE slug = $1',
    [slug]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'link not found' });
    return;
  }

  res.redirect(301, result.rows[0].url);
});

linkRouter.get('/:slug/stats', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;

  const linkResult = await pool.query('SELECT 1 FROM links WHERE slug = $1', [slug]);
  if (linkResult.rows.length === 0) {
    res.status(404).json({ error: 'link not found' });
    return;
  }

  const statsResult = await pool.query<{ clicks: string }>(
    'SELECT COUNT(*) AS clicks FROM clicks WHERE slug = $1',
    [slug]
  );

  res.json({ slug, clicks: Number(statsResult.rows[0].clicks) });
});

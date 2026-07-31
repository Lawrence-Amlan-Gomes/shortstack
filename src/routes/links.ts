import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { redis } from '../redis/client';
import { clickQueue } from '../queues/clickQueue';
import { optionalAuthenticate, AuthedRequest } from '../middleware/authenticate';

export const linkRouter = Router();

const CreateLinkSchema = z.object({
  url: z.string().url(),
});

const MAX_SLUG_ATTEMPTS = 5;

// Same slug generated twice hits the UNIQUE(slug) constraint — retry with a fresh
// random slug instead of surfacing a raw 500 to the client.
async function insertLinkWithUniqueSlug(url: string, userId: number | null): Promise<string> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = Math.random().toString(36).slice(2, 8);
    try {
      const result = await pool.query<{ slug: string }>(
        'INSERT INTO links (slug, url, user_id) VALUES ($1, $2, $3) RETURNING slug',
        [slug, url, userId]
      );
      return result.rows[0].slug;
    } catch (err) {
      const isUniqueViolation = (err as { code?: string }).code === '23505';
      if (!isUniqueViolation || attempt === MAX_SLUG_ATTEMPTS - 1) {
        throw err;
      }
    }
  }
  throw new Error('unreachable');
}

// Shared by the root-level `/:slug` redirect (app.ts) and this router's `/:slug` —
// cache-aside lookup + async click recording, one implementation instead of two.
export async function resolveSlug(
  slug: string
): Promise<{ url: string; cacheStatus: 'HIT' | 'MISS' } | null> {
  const cached = await redis.get(`slug:${slug}`);
  if (cached) {
    await clickQueue.add('record-click', { slug });
    return { url: cached, cacheStatus: 'HIT' };
  }

  const result = await pool.query<{ url: string }>(
    'SELECT url FROM links WHERE slug = $1',
    [slug]
  );
  if (result.rows.length === 0) {
    return null;
  }

  const url = result.rows[0].url;
  await redis.set(`slug:${slug}`, url, 'EX', 86400);
  await clickQueue.add('record-click', { slug });
  return { url, cacheStatus: 'MISS' };
}

linkRouter.post('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const parsed = CreateLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { url } = parsed.data;
  const { userId } = req as AuthedRequest; // set only if optionalAuthenticate found a valid token
  const savedSlug = await insertLinkWithUniqueSlug(url, userId ?? null);

  await redis.set(`slug:${savedSlug}`, url, 'EX', 86400); // warm cache so the first visit is already a HIT
  const base = process.env.BASE_URL ?? 'http://localhost:3000';
  res.status(201).json({ slug: savedSlug, short: `${base}/${savedSlug}` });
});

linkRouter.get('/:slug', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;
  const result = await resolveSlug(slug);

  if (!result) {
    res.status(404).json({ error: 'link not found' });
    return;
  }

  res.setHeader('X-Cache', result.cacheStatus);
  res.redirect(301, result.url);
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

  res.json({ slug, clicks: Number(statsResult.rows[0].clicks) }); // Postgres COUNT comes back as text
});

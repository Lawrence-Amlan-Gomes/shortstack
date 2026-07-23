// This is the links.ts file. What this file does is handle everything about short links:
// creating a new one (only for logged-in users), redirecting a visitor who clicks a short
// link, and reporting how many clicks a link has. It also holds the shared logic for
// looking up a slug through the Redis cache before falling back to Postgres.

import { Router, Request, Response } from 'express'; // Bring in Express's Router and its request/response types
import { z } from 'zod'; // Bring in 'zod', used to check that incoming data has the shape we expect
import { pool } from '../db/pool'; // Bring in the database connection
import { redis } from '../redis/client'; // Bring in the Redis connection, used as a fast cache
import { clickQueue } from '../queues/clickQueue'; // Bring in the click queue, used to record clicks without slowing down redirects
import { optionalAuthenticate, AuthedRequest } from '../middleware/authenticate'; // Bring in the "login is optional" middleware and its extra request fields

export const linkRouter = Router(); // Create a new mini-router just for link routes, and share it with the rest of the app

const CreateLinkSchema = z.object({ // Describe what a valid "create link" request body must look like
  url: z.string().url(), // Must be a piece of text shaped like a real web address
}); // End of the shape description

const MAX_SLUG_ATTEMPTS = 5; // How many times we'll try a new random slug before giving up

// Same slug generated twice hits the UNIQUE(slug) constraint — retry with a fresh
// random slug instead of surfacing a raw 500 to the client.
async function insertLinkWithUniqueSlug(url: string, userId: number | null): Promise<string> { // Define a function that saves a new link, trying a new slug if one collides. userId is null for anonymous, logged-out visitors
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) { // Repeat up to MAX_SLUG_ATTEMPTS times
    const slug = Math.random().toString(36).slice(2, 8); // Make a random 6-character slug out of letters and numbers
    try { // Try to save it, and catch it if the database rejects it
      const result = await pool.query<{ slug: string }>( // Wait while we insert the new link and ask Postgres to hand back the slug
        'INSERT INTO links (slug, url, user_id) VALUES ($1, $2, $3) RETURNING slug', // Add a new row to 'links' with this slug, url, and owning user
        [slug, url, userId] // Fill in $1, $2, $3 with the real values, safely
      ); // End of the insert
      return result.rows[0].slug; // Success — give back the slug that was actually saved
    } catch (err) { // If the insert failed
      const isUniqueViolation = (err as { code?: string }).code === '23505'; // Check if the failure was specifically Postgres's "duplicate value" error code
      if (!isUniqueViolation || attempt === MAX_SLUG_ATTEMPTS - 1) { // If it failed for a different reason, or we're out of attempts
        throw err; // Give up and let the error bubble up to be handled elsewhere
      } // End of the give-up check
    } // End of the try/catch
  } // End of the retry loop
  throw new Error('unreachable'); // This line should never actually run — it just satisfies TypeScript that the function always returns or throws
} // End of the insertLinkWithUniqueSlug function

// Shared by the root-level `/:slug` redirect (app.ts) and this router's `/:slug` —
// cache-aside lookup + async click recording, one implementation instead of two.
export async function resolveSlug( // Define a function that looks up where a slug should redirect to, and records the click
  slug: string // The short code from the URL, e.g. the "abc123" part
): Promise<{ url: string; cacheStatus: 'HIT' | 'MISS' } | null> { // It gives back the target URL and whether it came from cache, or null if not found
  const cached = await redis.get(`slug:${slug}`); // Wait while we ask Redis if it already has this slug's URL saved
  if (cached) { // If Redis had it
    await clickQueue.add('record-click', { slug }); // Add a job to the click queue so this visit gets counted later
    return { url: cached, cacheStatus: 'HIT' }; // Give back the cached URL, marked as a cache HIT
  } // End of the cache-hit path

  const result = await pool.query<{ url: string }>( // Wait while we ask Postgres directly, since Redis didn't have it
    'SELECT url FROM links WHERE slug = $1', // Look up the row in 'links' matching this slug
    [slug] // Fill in $1 with the real slug value, safely
  ); // End of the database lookup
  if (result.rows.length === 0) { // If no matching link was found at all
    return null; // Give back null so the caller can send a 404
  } // End of the not-found check

  const url = result.rows[0].url; // Grab the target URL from the matching row
  await redis.set(`slug:${slug}`, url, 'EX', 86400); // Save it in Redis for next time, expiring automatically after 86400 seconds (24 hours)
  await clickQueue.add('record-click', { slug }); // Add a job to the click queue so this visit gets counted later
  return { url, cacheStatus: 'MISS' }; // Give back the URL, marked as a cache MISS (it came from the database, not the cache)
} // End of the resolveSlug function

linkRouter.post('/', optionalAuthenticate, async (req: Request, res: Response) => { // When a POST request comes to '/' (create a link), first check for an optional login, then run this
  const parsed = CreateLinkSchema.safeParse(req.body); // Check the request body against CreateLinkSchema without throwing if it's wrong
  if (!parsed.success) { // If the body did not match the expected shape
    res.status(400).json({ error: parsed.error.flatten().fieldErrors }); // Send back a 400 (bad request) error explaining what was wrong
    return; // Stop here — do not continue creating a link
  } // End of the validation check

  const { url } = parsed.data; // Pull out the checked, safe URL from the request body
  const { userId } = req as AuthedRequest; // Read the logged-in user's ID, if 'optionalAuthenticate' found a valid token — undefined otherwise
  const savedSlug = await insertLinkWithUniqueSlug(url, userId ?? null); // Wait while we save the new link, owned by this user if logged in, or with no owner (null) if anonymous

  await redis.set(`slug:${savedSlug}`, url, 'EX', 86400); // Warm the Redis cache immediately, so the very first visit is already a cache HIT
  const base = process.env.BASE_URL ?? 'http://localhost:3000'; // Read the site's base address from the environment, or use a local default
  res.status(201).json({ slug: savedSlug, short: `${base}/${savedSlug}` }); // Send back 201 (created) along with the slug and the full short link
}); // End of the create-link route

linkRouter.get('/:slug', async (req: Request<{ slug: string }>, res: Response) => { // When a GET request comes to '/:slug' (a short link visit), run this
  const { slug } = req.params; // Read the slug out of the URL itself
  const result = await resolveSlug(slug); // Wait while we look up where this slug should redirect to

  if (!result) { // If resolveSlug found nothing
    res.status(404).json({ error: 'link not found' }); // Send back a 404 (not found) error
    return; // Stop here — nothing to redirect to
  } // End of the not-found check

  res.setHeader('X-Cache', result.cacheStatus); // Add a custom header showing whether this came from cache (HIT) or the database (MISS)
  res.redirect(301, result.url); // Send the visitor's browser to the real, original URL with a permanent (301) redirect
}); // End of the redirect route

linkRouter.get('/:slug/stats', async (req: Request<{ slug: string }>, res: Response) => { // When a GET request comes to '/:slug/stats', run this
  const { slug } = req.params; // Read the slug out of the URL itself

  const linkResult = await pool.query('SELECT 1 FROM links WHERE slug = $1', [slug]); // Wait while we check whether this slug exists at all
  if (linkResult.rows.length === 0) { // If no link was found with this slug
    res.status(404).json({ error: 'link not found' }); // Send back a 404 (not found) error
    return; // Stop here — no stats to show for a link that doesn't exist
  } // End of the not-found check

  const statsResult = await pool.query<{ clicks: string }>( // Wait while we count how many times this slug has been clicked
    'SELECT COUNT(*) AS clicks FROM clicks WHERE slug = $1', // Count every row in 'clicks' that matches this slug
    [slug] // Fill in $1 with the real slug value, safely
  ); // End of the count query

  res.json({ slug, clicks: Number(statsResult.rows[0].clicks) }); // Send back the slug and its click count as a normal number (Postgres COUNT comes back as text)
}); // End of the stats route

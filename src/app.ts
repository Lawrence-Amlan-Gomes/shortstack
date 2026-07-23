// This is the app.ts file. What this file does is build the actual Express application:
// it wires together security middleware, the admin dashboard, the static frontend files,
// the root-level short-link redirect, and all the API routes. index.ts is the file that
// actually starts this app listening on a port — this file just builds it.

import 'dotenv/config'; // Load variables from the .env file into process.env, so the rest of the app can read them
import path from 'path'; // Bring in Node's 'path' tool, used to safely build file paths
import express, { Request, Response } from 'express'; // Bring in Express itself, plus its request/response types
import cors from 'cors'; // Bring in 'cors', used to control which websites are allowed to call this API
import rateLimit from 'express-rate-limit'; // Bring in 'express-rate-limit', used to cap how many requests one visitor can make
import helmet from 'helmet'; // Bring in 'helmet', used to add safer default security headers to every response
import { createBullBoard } from '@bull-board/api'; // Bring in the tool that builds the Bull Board admin dashboard for queues
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'; // Bring in the adapter that lets Bull Board understand a BullMQ queue
import { ExpressAdapter } from '@bull-board/express'; // Bring in the adapter that lets Bull Board plug into an Express app
import basicAuth from 'express-basic-auth'; // Bring in 'express-basic-auth', used to password-protect a route with a simple login popup
import { linkRouter, resolveSlug } from './routes/links'; // Bring in the link routes, plus the shared slug-lookup function
import { authRouter } from './routes/auth'; // Bring in the register/login routes
import { errorHandler } from './middleware/errorHandler'; // Bring in the catch-all error handler
import { clickQueue } from './queues/clickQueue'; // Bring in the click queue, needed to show it on the Bull Board dashboard

const skipInTest = () => process.env.NODE_ENV === 'test'; // A helper that says "true" only when the app is running under the test suite

const createLinkLimiter = rateLimit({ // Build a rate limiter for creating links
  windowMs: 60 * 1000, // The time window is 60,000 milliseconds, which is 1 minute
  max: 10, // Allow at most 10 requests per visitor within that 1 minute window
  message: { error: 'Too many links created, please try again later.' }, // The message sent back once the limit is hit
  skip: skipInTest, // Turn this limiter off entirely while running automated tests
}); // End of the link-creation limiter

const authLimiter = rateLimit({ // Build a rate limiter for register/login
  windowMs: 60 * 1000, // The time window is 60,000 milliseconds, which is 1 minute
  max: 10, // Allow at most 10 requests per visitor within that 1 minute window
  message: { error: 'Too many requests, please try again later.' }, // The message sent back once the limit is hit
  skip: skipInTest, // Turn this limiter off entirely while running automated tests
}); // End of the auth limiter

export const app = express(); // Create the actual Express application and share it with the rest of the project

app.use(helmet()); // Add helmet's safer default security headers to every response
app.use(cors({ // Add CORS rules to every response
  origin: process.env.FRONTEND_URL ?? '*', // Only allow requests from this exact frontend address, or allow anyone if none is set
  credentials: true, // Allow cookies/auth headers to be included in cross-site requests
})); // End of the CORS setup
app.use(express.json()); // Automatically read incoming JSON request bodies into req.body

const serverAdapter = new ExpressAdapter(); // Create an adapter so Bull Board can hook into this Express app
serverAdapter.setBasePath('/admin/queues'); // Tell Bull Board it will be served under the '/admin/queues' path
createBullBoard({ queues: [new BullMQAdapter(clickQueue)], serverAdapter }); // Build the actual dashboard, showing the 'clicks' queue
app.use('/admin/queues', basicAuth({ // Protect everything under '/admin/queues' with a username/password popup
  users: { [process.env.BULL_BOARD_USER ?? 'admin']: process.env.BULL_BOARD_PASSWORD ?? '' }, // The one allowed username/password pair, read from the environment
  challenge: true, // Make the browser show its built-in login popup instead of just failing silently
}), serverAdapter.getRouter()); // Hand off matching requests to Bull Board's own router

app.use(express.static(path.join(__dirname, '../client/dist'))); // Serve the built React frontend's files directly (HTML, JS, CSS)

app.get('/health', (_req, res) => { // When a GET request comes to '/health', run this
  res.json({ status: 'ok' }); // Send back a simple JSON message saying the server is alive
}); // End of the health-check route

app.get('/:slug', async (req: Request<{ slug: string }>, res: Response) => { // When a GET request comes to any single path segment (a short link visit), run this
  const { slug } = req.params; // Read the slug out of the URL itself
  const result = await resolveSlug(slug); // Wait while we look up where this slug should redirect to (checks Redis first, then Postgres)

  if (!result) { // If resolveSlug found nothing
    res.status(404).json({ error: 'link not found' }); // Send back a 404 (not found) error
    return; // Stop here — nothing to redirect to
  } // End of the not-found check

  res.setHeader('X-Cache', result.cacheStatus); // Add a custom header showing whether this came from cache (HIT) or the database (MISS)
  res.redirect(301, result.url); // Send the visitor's browser to the real, original URL with a permanent (301) redirect
}); // End of the root-level redirect route

app.post('/api/links', createLinkLimiter); // Apply the link-creation rate limiter only to POST requests on '/api/links'
app.use('/api/links', linkRouter); // Hand off any request under '/api/links' to the link routes
app.post('/api/auth/register', authLimiter); // Apply the auth rate limiter only to POST requests on '/api/auth/register'
app.post('/api/auth/login', authLimiter); // Apply the auth rate limiter only to POST requests on '/api/auth/login'
app.use('/api/auth', authRouter); // Hand off any request under '/api/auth' to the auth routes

app.use(errorHandler); // Catch any error that reached this point without being handled, and send back a clean 500 response

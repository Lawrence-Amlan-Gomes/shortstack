// This is the auth.ts file. What this file does is handle account creation (register),
// logging in (login), and refreshing an expired login session (refresh). It checks the
// data sent in, stores passwords safely (never as plain text), and hands back two tokens:
// a short-lived access token (JWT) the frontend uses on every request, and a long-lived
// refresh token it trades in for a new access token once the old one expires — so the
// user doesn't have to log in again every 15 minutes.

import { Router, Request, Response } from 'express'; // Bring in Express's Router (a mini app for a group of routes) and its request/response types
import bcrypt from 'bcrypt'; // Bring in 'bcrypt', used to scramble (hash) and check passwords safely
import jwt from 'jsonwebtoken'; // Bring in 'jsonwebtoken', used to create and read login tokens
import crypto from 'crypto'; // Bring in Node's built-in 'crypto' tool, used to make secure random refresh tokens and hash them
import { z } from 'zod'; // Bring in 'zod', used to check that incoming data has the shape we expect
import { pool } from '../db/pool'; // Bring in the database connection so we can read and write users

export const authRouter = Router(); // Create a new mini-router just for auth routes, and share it with the rest of the app

const ACCESS_TOKEN_EXPIRY = '15m'; // How long a short-lived access token stays valid before the frontend must refresh it
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // How long a long-lived refresh token stays valid: 30 days, in milliseconds

const JWT_SECRET = () => { // Define a function that gives back the secret key used to sign tokens
  if (!process.env.JWT_SECRET) { // If no secret key was set in the environment
    throw new Error('JWT_SECRET environment variable is not set'); // Stop everything with an error instead of silently using a weak default
  } // End of the missing-secret check
  return process.env.JWT_SECRET; // Give back the real secret key from the environment
}; // End of the JWT_SECRET function

function hashRefreshToken(rawToken: string): string { // Define a function that turns a raw refresh token into a safe, one-way hash for storage
  return crypto.createHash('sha256').update(rawToken).digest('hex'); // Run the token through SHA-256 — a fast hash is fine here (unlike passwords) because this input is already random and unguessable, not something a human chose
} // End of the hashRefreshToken function

async function issueRefreshToken(userId: number): Promise<string> { // Define a function that creates and stores a brand-new refresh token for a given user
  const rawToken = crypto.randomBytes(48).toString('hex'); // Generate 48 random bytes and turn them into a long hex string — this is the actual token the client will store
  const tokenHash = hashRefreshToken(rawToken); // Hash the raw token so the database never holds the real, usable token
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS); // Work out the exact moment this token should stop working, 30 days from now
  await pool.query( // Wait while we save this new refresh token's hash in the database
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', // Add a new row to 'refresh_tokens' with the owner, the hash, and the expiry time
    [userId, tokenHash, expiresAt] // Fill in $1, $2, $3 with the real values, safely
  ); // End of the insert
  return rawToken; // Give back the raw token — this is the only moment it exists in readable form, so the caller must send it to the client now
} // End of the issueRefreshToken function

const RegisterSchema = z.object({ // Describe what a valid "register" request body must look like
  email: z.string().email(), // Must be a piece of text shaped like a real email address
  password: z.string().min(8), // Must be a piece of text at least 8 characters long
  app: z.string().min(1), // Must be a piece of text at least 1 character long (which app the user is signing up for)
}); // End of the register shape description

const LoginSchema = z.object({ // Describe what a valid "login" request body must look like
  email: z.string().email(), // Must be a piece of text shaped like a real email address
  password: z.string().min(1), // Must be a piece of text at least 1 character long
  app: z.string().min(1), // Must be a piece of text at least 1 character long (which app the user is logging into)
}); // End of the login shape description

authRouter.post('/register', async (req: Request, res: Response) => { // When a POST request comes to '/register', run this
  const parsed = RegisterSchema.safeParse(req.body); // Check the request body against RegisterSchema without throwing if it's wrong
  if (!parsed.success) { // If the body did not match the expected shape
    res.status(400).json({ error: parsed.error.flatten().fieldErrors }); // Send back a 400 (bad request) error explaining what was wrong
    return; // Stop here — do not continue registering
  } // End of the validation check

  const { email, password, app } = parsed.data; // Pull out the checked, safe values from the request body

  const existing = await pool.query( // Wait while we ask the database if this user already exists
    'SELECT id FROM users WHERE email = $1 AND app = $2', // Look for a user row with this exact email and app combination
    [email, app] // Fill in $1 and $2 with the real email and app values, safely (prevents SQL injection)
  ); // End of the existing-user lookup
  if (existing.rows.length > 0) { // If we found at least one matching row
    res.status(409).json({ error: 'email already registered for this app' }); // Send back a 409 (conflict) error — this account already exists
    return; // Stop here — do not create a duplicate account
  } // End of the duplicate check

  const passwordHash = await bcrypt.hash(password, 12); // Wait while bcrypt scrambles the password into a safe, one-way hash (12 = how much extra work to slow down attackers)
  const result = await pool.query<{ id: number; email: string }>( // Wait while we insert the new user and ask Postgres to hand back their id and email
    'INSERT INTO users (email, app, password_hash) VALUES ($1, $2, $3) RETURNING id, email', // Add a new row to 'users' with the given email, app, and scrambled password
    [email, app, passwordHash] // Fill in $1, $2, $3 with the real values, safely
  ); // End of the insert

  const user = result.rows[0]; // Grab the single new user row that came back from the insert
  const token = jwt.sign({ userId: user.id, app }, JWT_SECRET(), { expiresIn: ACCESS_TOKEN_EXPIRY }); // Create a short-lived access token containing the user's id and app
  const refreshToken = await issueRefreshToken(user.id); // Wait while we create a long-lived refresh token the client can trade in for new access tokens later
  res.status(201).json({ token, refreshToken, user: { id: user.id, email: user.email, app } }); // Send back 201 (created) along with both tokens and basic user info
}); // End of the /register route

authRouter.post('/login', async (req: Request, res: Response) => { // When a POST request comes to '/login', run this
  const parsed = LoginSchema.safeParse(req.body); // Check the request body against LoginSchema without throwing if it's wrong
  if (!parsed.success) { // If the body did not match the expected shape
    res.status(400).json({ error: parsed.error.flatten().fieldErrors }); // Send back a 400 (bad request) error explaining what was wrong
    return; // Stop here — do not continue logging in
  } // End of the validation check

  const { email, password, app } = parsed.data; // Pull out the checked, safe values from the request body

  const result = await pool.query<{ id: number; email: string; password_hash: string }>( // Wait while we look up this user's stored info
    'SELECT id, email, password_hash FROM users WHERE email = $1 AND app = $2', // Find the user row matching this email and app combination
    [email, app] // Fill in $1 and $2 with the real values, safely
  ); // End of the user lookup

  if (result.rows.length === 0) { // If no user was found with that email/app combination
    res.status(401).json({ error: 'invalid credentials' }); // Send back a 401 (not allowed) error — don't reveal whether it was the email or password that was wrong
    return; // Stop here — do not continue logging in
  } // End of the not-found check

  const user = result.rows[0]; // Grab the matching user row
  const valid = await bcrypt.compare(password, user.password_hash); // Wait while bcrypt checks if the given password matches the stored scrambled password
  if (!valid) { // If the password does not match
    res.status(401).json({ error: 'invalid credentials' }); // Send back the same 401 error as before, for the same reason (don't reveal which part was wrong)
    return; // Stop here — do not log the user in
  } // End of the password check

  const token = jwt.sign({ userId: user.id, app }, JWT_SECRET(), { expiresIn: ACCESS_TOKEN_EXPIRY }); // Create a short-lived access token containing the user's id and app
  const refreshToken = await issueRefreshToken(user.id); // Wait while we create a long-lived refresh token the client can trade in for new access tokens later
  res.json({ token, refreshToken, user: { id: user.id, email: user.email, app } }); // Send back 200 (ok) along with both tokens and basic user info
}); // End of the /login route

const RefreshSchema = z.object({ // Describe what a valid "refresh" request body must look like
  refreshToken: z.string().min(1), // Must be a piece of text at least 1 character long
}); // End of the refresh shape description

authRouter.post('/refresh', async (req: Request, res: Response) => { // When a POST request comes to '/refresh', run this
  const parsed = RefreshSchema.safeParse(req.body); // Check the request body against RefreshSchema without throwing if it's wrong
  if (!parsed.success) { // If the body did not match the expected shape
    res.status(400).json({ error: parsed.error.flatten().fieldErrors }); // Send back a 400 (bad request) error explaining what was wrong
    return; // Stop here — do not continue refreshing
  } // End of the validation check

  const { refreshToken } = parsed.data; // Pull out the checked, safe refresh token from the request body
  const tokenHash = hashRefreshToken(refreshToken); // Hash the incoming token the same way it was hashed when it was created, so we can find its row

  const result = await pool.query<{ id: number; user_id: number; app: string; expires_at: Date; revoked_at: Date | null }>( // Wait while we look up this refresh token's row, joined with its owner's app
    `SELECT rt.id, rt.user_id, u.app, rt.expires_at, rt.revoked_at
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`, // Find the refresh token row matching this hash, plus which app its owner belongs to
    [tokenHash] // Fill in $1 with the real hash value, safely
  ); // End of the lookup

  if (result.rows.length === 0) { // If no refresh token matches this hash at all
    res.status(401).json({ error: 'invalid refresh token' }); // Send back a 401 (not allowed) error — this token was never issued
    return; // Stop here — nothing valid to refresh
  } // End of the not-found check

  const stored = result.rows[0]; // Grab the matching refresh token row

  if (stored.revoked_at !== null) { // If this exact token was already used once before (rotation already replaced it with a new one)
    res.status(401).json({ error: 'refresh token already used' }); // Send back a 401 (not allowed) error — reusing a rotated-out token is a sign of theft, not a normal retry
    return; // Stop here — refuse to issue new tokens from an already-spent one
  } // End of the reuse check

  if (new Date(stored.expires_at).getTime() < Date.now()) { // If this token's expiry date has already passed
    res.status(401).json({ error: 'refresh token expired' }); // Send back a 401 (not allowed) error — the user needs to log in again
    return; // Stop here — an expired token cannot be refreshed
  } // End of the expiry check

  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [stored.id]); // Wait while we mark this token as spent, so it can never be used again (this is "rotation")

  const newAccessToken = jwt.sign({ userId: stored.user_id, app: stored.app }, JWT_SECRET(), { expiresIn: ACCESS_TOKEN_EXPIRY }); // Create a brand-new short-lived access token for this same user
  const newRefreshToken = await issueRefreshToken(stored.user_id); // Wait while we create a brand-new refresh token to replace the one we just spent

  res.json({ token: newAccessToken, refreshToken: newRefreshToken }); // Send back 200 (ok) along with the fresh pair of tokens
}); // End of the /refresh route

// This is the auth.ts file. What this file does is handle account creation (register)
// and logging in (login). It checks the data sent in, stores passwords safely (never
// as plain text), and hands back a login token (JWT) the frontend can use to prove who
// the user is on later requests.

import { Router, Request, Response } from 'express'; // Bring in Express's Router (a mini app for a group of routes) and its request/response types
import bcrypt from 'bcrypt'; // Bring in 'bcrypt', used to scramble (hash) and check passwords safely
import jwt from 'jsonwebtoken'; // Bring in 'jsonwebtoken', used to create and read login tokens
import { z } from 'zod'; // Bring in 'zod', used to check that incoming data has the shape we expect
import { pool } from '../db/pool'; // Bring in the database connection so we can read and write users

export const authRouter = Router(); // Create a new mini-router just for auth routes, and share it with the rest of the app

const JWT_SECRET = () => { // Define a function that gives back the secret key used to sign tokens
  if (!process.env.JWT_SECRET) { // If no secret key was set in the environment
    throw new Error('JWT_SECRET environment variable is not set'); // Stop everything with an error instead of silently using a weak default
  } // End of the missing-secret check
  return process.env.JWT_SECRET; // Give back the real secret key from the environment
}; // End of the JWT_SECRET function

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
  const token = jwt.sign({ userId: user.id, app }, JWT_SECRET(), { expiresIn: '7d' }); // Create a login token containing the user's id and app, valid for 7 days
  res.status(201).json({ token, user: { id: user.id, email: user.email, app } }); // Send back 201 (created) along with the token and basic user info
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

  const token = jwt.sign({ userId: user.id, app }, JWT_SECRET(), { expiresIn: '7d' }); // Create a login token containing the user's id and app, valid for 7 days
  res.json({ token, user: { id: user.id, email: user.email, app } }); // Send back 200 (ok) along with the token and basic user info
}); // End of the /login route

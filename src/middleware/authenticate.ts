// This is the authenticate.ts file. What this file does is check that a request has a
// valid login token (JWT) before letting it continue. It runs in front of routes that
// should only work for logged-in users, like creating a new short link. If the token is
// missing or fake, it stops the request here and sends back an error instead.

import { NextFunction, Request, Response } from 'express'; // Bring in Express's types for the request, response, and "go to the next step" function
import jwt from 'jsonwebtoken'; // Bring in the 'jsonwebtoken' package, used to check and read login tokens

export interface AuthedRequest extends Request { // Describe a normal Express request, plus some extra fields we add after checking the token
  userId?: number; // The ID of the logged-in user, filled in once the token is verified
  tenantApp?: string; // Which "app" this user belongs to, filled in once the token is verified (named tenantApp, not app, so it never clashes with Express's own built-in req.app)
} // End of the shape description

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) { // Define the middleware function Express will run before the real route
  const header = req.headers.authorization; // Read the 'Authorization' header sent with the request (should look like "Bearer xxxxx")
  if (!header?.startsWith('Bearer ')) { // If there is no header, or it does not start with the word "Bearer "
    res.status(401).json({ error: 'missing or malformed authorization header' }); // Send back a 401 (not allowed) error explaining why
    return; // Stop here — do not let the request continue to the real route
  } // End of the missing-header check

  const token = header.slice('Bearer '.length); // Cut off the word "Bearer " from the start, leaving just the actual token text

  try { // Try the next steps, and catch it if something goes wrong
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; app: string }; // Check the token is real and not expired, then read the information stored inside it
    req.userId = payload.userId; // Save the logged-in user's ID onto the request, so later code can use it
    req.tenantApp = payload.app; // Save which app the user belongs to onto the request, so later code can use it
    next(); // The token is valid — let the request continue to the real route
  } catch { // If jwt.verify threw an error (token is fake, broken, or expired)
    res.status(401).json({ error: 'invalid or expired token' }); // Send back a 401 (not allowed) error explaining why
  } // End of the try/catch
} // End of the authenticate function

// This is the "optional" version — used on routes that should work for anyone, logged in
// or not, but should still know WHO created something if they happen to be logged in.
// Unlike 'authenticate' above, this one never sends a 401 — it just leaves req.userId
// empty when there's no valid token, instead of blocking the request.
export function optionalAuthenticate(req: AuthedRequest, res: Response, next: NextFunction) { // Define the "don't require login, but check if one exists" middleware
  const header = req.headers.authorization; // Read the 'Authorization' header sent with the request (should look like "Bearer xxxxx")
  if (!header?.startsWith('Bearer ')) { // If there is no header, or it does not start with the word "Bearer "
    next(); // Just continue on — this request is allowed to be anonymous
    return; // Stop here — nothing else to check
  } // End of the missing-header check

  const token = header.slice('Bearer '.length); // Cut off the word "Bearer " from the start, leaving just the actual token text

  try { // Try to read the token, and catch it if something goes wrong
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; app: string }; // Check the token is real and not expired, then read the information stored inside it
    req.userId = payload.userId; // Save the logged-in user's ID onto the request, so later code can use it
    req.tenantApp = payload.app; // Save which app the user belongs to onto the request, so later code can use it
  } catch { // If the token was present but fake, broken, or expired
    // Do nothing — treat it the same as not being logged in, instead of blocking the request
  } // End of the try/catch
  next(); // Either way (valid token, bad token, or no token), let the request continue
} // End of the optionalAuthenticate function

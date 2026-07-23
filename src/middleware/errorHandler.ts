// This is the errorHandler.ts file. What this file does is catch any error that happens
// in a route and wasn't already handled, so the app can send back a clean error message
// instead of crashing or leaking messy details to whoever made the request.

import { Request, Response, NextFunction } from 'express'; // Bring in Express's types for the request, response, and "next" function

export function errorHandler( // Define the special error-handling middleware (Express knows it's this kind because it takes 4 arguments)
  err: Error, // The error that was thrown somewhere earlier in the app
  _req: Request, // The incoming request (not used here, so the name starts with _ to mark it unused)
  res: Response, // The response we send back to whoever made the request
  _next: NextFunction // The "go to the next step" function (not used here, so the name starts with _ to mark it unused)
): void { // This function does not give back any value
  console.error(err.stack); // Print the full error details to the server's console/logs, so we (the developers) can see what went wrong
  res.status(500).json({ error: 'internal server error' }); // Send back a generic 500 (something broke) message to the client, without leaking internal details
} // End of the errorHandler function

// This is the index.ts file. What this file does is actually start the server: it checks
// that required setup exists, runs the database migration, starts the background click
// worker, and then makes the Express app (from app.ts) start listening for real requests.
// This is the file you run to boot the whole app.

import { app } from './app'; // Bring in the fully-built Express app from app.ts
import { migrate } from './db/migrate'; // Bring in the function that creates/updates database tables
import { startClickWorker } from './workers/clickWorker'; // Bring in the function that starts the background click-saving worker

if (!process.env.JWT_SECRET) { // If no login-token secret was set in the environment
  console.error('JWT_SECRET environment variable is not set — refusing to start'); // Print a clear error explaining why we're stopping
  process.exit(1); // Shut down the whole process immediately, with a non-zero code meaning "something went wrong"
} // End of the missing-secret check

const PORT = process.env.PORT ?? 3000; // Use the PORT value from the environment, or 3000 if none is set

migrate() // Start creating/updating the database tables, and wait for it to finish
  .then(() => { // Once the migration succeeds, run this
    startClickWorker(); // Turn on the background worker that saves clicks from the queue
    app.listen(PORT, () => { // Start the Express app listening on our chosen port, and run this once it's actually listening
      console.log(`Server running on port ${PORT}`); // Print a friendly message showing which port the server is on
    }); // End of the listen callback
  }) // End of the success handler
  .catch((err) => { // If the migration failed instead of succeeding
    console.error('Migration failed:', err); // Print the error so we can see what went wrong
    process.exit(1); // Shut down the whole process, since the app can't safely run without a working database
  }); // End of the failure handler

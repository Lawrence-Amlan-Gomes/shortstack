// This is the create-test-db.ts file. What this file does is create the separate
// 'shortstack_test' database used by the automated test suite, so tests never touch
// the real production database. You run this once before running tests for the first
// time (npm run test:setup).

import 'dotenv/config'; // Load variables from the .env file into process.env, so we can read DATABASE_URL
import { Pool } from 'pg'; // Bring in the 'Pool' tool from the 'pg' package, used to connect to Postgres

async function createTestDB() { // Define a function that creates the test database if it doesn't already exist
  const url = new URL(process.env.DATABASE_URL!); // Read our normal database address and break it apart into pieces (host, username, password, etc.)
  const adminUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres`; // Build a connection string to the default 'postgres' database, using the same login details

  const adminPool = new Pool({ connectionString: adminUrl }); // Open a connection to that default database, since we need to connect somewhere before creating a new database

  try { // Try to create the new database, and handle it if something goes wrong
    await adminPool.query('CREATE DATABASE shortstack_test'); // Wait while we ask Postgres to create a brand-new database named 'shortstack_test'
    console.log('Created database: shortstack_test'); // Print a success message
  } catch (err: unknown) { // If the CREATE DATABASE command failed
    if (err instanceof Error && err.message.includes('already exists')) { // If the failure was specifically because the database already exists
      console.log('Database shortstack_test already exists — skipping'); // Print a friendly message instead of treating this as a real problem
    } else { // If it failed for some other, unexpected reason
      throw err; // Let the error bubble up, since this one really is a problem
    } // End of the error-type check
  } finally { // No matter whether it succeeded or failed
    await adminPool.end(); // Wait while we close the connection to the 'postgres' database, since we're done with it
  } // End of the try/catch/finally
} // End of the createTestDB function

createTestDB().catch((err) => { // Run the function, and if it throws an error that wasn't already handled
  console.error(err); // Print the error so we can see what went wrong
  process.exit(1); // Stop the script with a non-zero code, meaning "something went wrong"
}); // End of the top-level error handler

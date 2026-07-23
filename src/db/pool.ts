// This is the pool.ts file. What this file does is open a connection to the Postgres
// database and share that one connection with the rest of the app, so every file that
// needs to talk to the database imports it from here instead of making a new connection.

import { Pool } from 'pg'; // Bring in the 'Pool' tool from the 'pg' package — it manages a group of ready-to-use database connections

export const pool = new Pool({ // Create the pool of connections and make it available to other files
  connectionString: process.env.DATABASE_URL, // Use the database address and password stored in the DATABASE_URL environment variable
}); // End of the pool setup

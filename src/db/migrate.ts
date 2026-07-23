// This is the migrate.ts file. What this file does is set up the database structure —
// it creates the tables (links, clicks, users) and updates them if something changed
// since the last time the app started. It runs once, every time the server boots up.
//
// Note on comments below: the SQL text lives inside backtick strings (template literals).
// JavaScript's `//` comment does NOT work inside those strings — it would become literal
// text sent to the database and break the query. So inside the backticks we use SQL's own
// comment style (`--`), which Postgres safely ignores. Outside the backticks, normal `//` is used.

import { pool } from "./pool"; // Bring in the database connection so we can send commands to Postgres

export async function migrate(): Promise<void> { // Start a function named 'migrate' that returns nothing useful, just waits until done
  // Send this command to the database and wait for it to finish
  await pool.query(`
    -- Create a new table named 'links' only if it does not exist yet
    CREATE TABLE IF NOT EXISTS links (
      id         SERIAL PRIMARY KEY, -- Create an 'id' column that counts up automatically (1, 2, 3...) and acts as a unique ID
      slug       VARCHAR(10) UNIQUE NOT NULL, -- Create a 'slug' column (up to 10 letters/numbers), must be different for every row, cannot be empty
      url        TEXT NOT NULL, -- Create a 'url' column to store the long web address, cannot be empty
      created_at TIMESTAMPTZ DEFAULT NOW() -- Create a 'created_at' column that saves the exact time the row was made, automatically
    ) -- End of the table design
  `);

  // This creates a 'clicks' table to save each link click with an automatic ID, the link name,
  // and the current time, if the table does not exist already.
  await pool.query(`
    -- Create a new table named 'clicks' only if it does not exist yet
    CREATE TABLE IF NOT EXISTS clicks (
      id         SERIAL PRIMARY KEY, -- Create an 'id' column that counts up automatically (1, 2, 3...) and acts as a unique ID
      slug       VARCHAR(10) NOT NULL REFERENCES links(slug), -- Create a 'slug' column (up to 10 letters/numbers) that cannot be empty and connects to the 'slug' in the 'links' table
      clicked_at TIMESTAMPTZ DEFAULT NOW() -- Create a 'clicked_at' column to save the time of the click, using the exact current time by default
    ) -- End of the table design
  `);

  // Send this command to the database and wait for it to finish
  await pool.query(`
    -- Create a new table named 'users' only if it does not exist yet
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY, -- Create an 'id' column that counts up automatically and acts as a unique ID
      email         VARCHAR(255) NOT NULL, -- Create an 'email' column (up to 255 letters/numbers), cannot be empty
      app           VARCHAR(50)  NOT NULL DEFAULT 'default', -- Create an 'app' column (up to 50 letters/numbers) that says which app this user signed up for, defaults to 'default' if not given
      password_hash TEXT NOT NULL, -- Create a 'password_hash' column to store the scrambled (safe) version of the password, cannot be empty
      created_at    TIMESTAMPTZ DEFAULT NOW() -- Create a 'created_at' column that saves the exact time the row was made, automatically
    ) -- End of the table design
  `);

  // Add app column if table existed before this column was introduced
  await pool.query(`
    -- Change the 'users' table: add the 'app' column only if it is missing, giving old rows the value 'default'
    ALTER TABLE users ADD COLUMN IF NOT EXISTS app VARCHAR(50) NOT NULL DEFAULT 'default'
  `);

  // Remove name column if it exists from a previous schema
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS name`); // Change the 'users' table: delete the 'name' column only if it still exists

  // Drop old email-only unique constraint if it exists, replace with (email, app)
  await pool.query(
    `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`, // Change the 'users' table: remove the old rule that said every email must be unique by itself
  );
  // Send this command to the database and wait for it to finish
  await pool.query(`
    DO $$ BEGIN -- Start a block of Postgres code that can contain an IF check (plain SQL alone cannot)
      IF NOT EXISTS ( -- Only continue if the following search finds nothing
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_app_key' -- Look inside Postgres's own list of rules for one named 'users_email_app_key'
      ) THEN -- If that rule was not found, do the next line
        ALTER TABLE users ADD CONSTRAINT users_email_app_key UNIQUE (email, app); -- Add a new rule: the combination of email + app together must be unique
      END IF; -- End of the IF check
    END $$ -- End of the block of Postgres code
  `);
  // Send this command to the database and wait for it to finish
  await pool.query(`
    -- Change the 'links' table: add a 'user_id' column only if it is missing, connecting each link to the user who made it
    ALTER TABLE links ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)
  `);

  // Send this command to the database and wait for it to finish
  await pool.query(`
    -- Build a fast lookup shortcut (an index) on the 'slug' column of 'links', only if it does not exist yet, so searching by slug is quick
    CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
  `);
  // Send this command to the database and wait for it to finish
  await pool.query(`
    -- Build a fast lookup shortcut (an index) on the 'slug' column of 'clicks', only if it does not exist yet, so searching by slug is quick
    CREATE INDEX IF NOT EXISTS idx_clicks_slug ON clicks(slug);
  `);
} // End of the migrate function

import { pool } from "./pool";

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      id         SERIAL PRIMARY KEY,
      slug       VARCHAR(10) UNIQUE NOT NULL,
      url        TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clicks (
      id         SERIAL PRIMARY KEY,
      slug       VARCHAR(10) NOT NULL REFERENCES links(slug),
      clicked_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) NOT NULL,
      app           VARCHAR(50)  NOT NULL DEFAULT 'default',
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add app column if table existed before this column was introduced
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS app VARCHAR(50) NOT NULL DEFAULT 'default'
  `);

  // Remove name column if it exists from a previous schema
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS name`);

  // Drop old email-only unique constraint if it exists, replace with (email, app)
  await pool.query(
    `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`,
  );
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_app_key'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_app_key UNIQUE (email, app);
      END IF;
    END $$
  `);
  await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
`);
  await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_clicks_slug ON clicks(slug);
`);
}

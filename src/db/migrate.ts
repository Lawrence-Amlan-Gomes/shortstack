import { pool } from "./pool";

// Runs on every boot. All statements are idempotent (IF NOT EXISTS / IF EXISTS) so this
// is safe to run against a fresh DB or one that's already up to date.
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

  // Backfill for tables created before multi-tenant `app` was introduced.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS app VARCHAR(50) NOT NULL DEFAULT 'default'
  `);

  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS name`);

  // Old schema had a bare UNIQUE(email); multi-tenant requires UNIQUE(email, app) instead.
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
    ALTER TABLE links ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_clicks_slug ON clicks(slug);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
  `);
}

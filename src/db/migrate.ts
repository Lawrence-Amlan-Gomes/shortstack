import { pool } from './pool';

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
      app           VARCHAR(50)  NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(email, app)
    )
  `);
}

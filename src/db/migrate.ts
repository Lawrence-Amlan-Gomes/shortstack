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
}

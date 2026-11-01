import { Worker } from 'bullmq';
import { pool } from '../db/pool';
import { redisConnection } from '../redis/client';
import type { ClickJobData } from '../queues/clickQueue';

export function startClickWorker() {
  const worker = new Worker<ClickJobData>(
    'clicks',
    async (job) => {
      await pool.query('INSERT INTO clicks (slug) VALUES ($1)', [job.data.slug]);
    },
    {
      connection: redisConnection,
      // Upstash Free bills every command (500k/month). The defaults (5s blocking
      // read, 30s stalled check) cost ~17k commands/day while idle and exhausted
      // the quota in Oct 2026. New jobs wake the blocking read immediately via the
      // marker key, so a long drainDelay adds no click latency.
      drainDelay: 60,
      stalledInterval: 5 * 60 * 1000,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Click job ${job?.id} failed:`, err.message);
  });

  return worker;
}

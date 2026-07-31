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
    { connection: redisConnection }
  );

  worker.on('failed', (job, err) => {
    console.error(`Click job ${job?.id} failed:`, err.message);
  });

  return worker;
}

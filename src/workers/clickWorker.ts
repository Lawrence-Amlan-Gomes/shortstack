// This is the clickWorker.ts file. What this file does is watch the 'clicks' queue
// (from clickQueue.ts) and, whenever a new job shows up, actually save that click into
// the Postgres database. This runs separately from the redirect request, so visitors
// get redirected instantly and don't have to wait for the database write.

import { Worker } from 'bullmq'; // Bring in the 'Worker' tool from BullMQ — it listens for jobs and processes them
import { pool } from '../db/pool'; // Bring in the database connection so we can save clicks
import { redisConnection } from '../redis/client'; // Bring in the Redis address, since BullMQ stores its jobs there
import type { ClickJobData } from '../queues/clickQueue'; // Bring in the shape of a click job, just for type-checking (not real code)

export function startClickWorker() { // Start a function that turns on the worker and hands it back so it can be stopped later
  const worker = new Worker<ClickJobData>( // Create a new worker that only processes jobs shaped like ClickJobData
    'clicks', // Listen to the queue named 'clicks' — must match the name used in clickQueue.ts
    async (job) => { // For every job that comes in, run this function
      await pool.query('INSERT INTO clicks (slug) VALUES ($1)', [job.data.slug]); // Wait while we add a new row to the 'clicks' table with this job's slug
    }, // End of the per-job function
    { connection: redisConnection } // Tell the worker which Redis server to listen on
  ); // End of the worker setup

  worker.on('failed', (job, err) => { // Whenever a job fails (throws an error) instead of finishing, run this
    console.error(`Click job ${job?.id} failed:`, err.message); // Print which job failed and why, so we can see it in the logs
  }); // End of the failure handler

  return worker; // Give back the worker object so whoever started it can close it later
} // End of the startClickWorker function

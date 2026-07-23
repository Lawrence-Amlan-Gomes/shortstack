// This is the clickQueue.ts file. What this file does is create the BullMQ "queue" —
// a waiting line, stored in Redis, where the app drops a small task every time someone
// visits a short link. A separate worker file (clickWorker.ts) picks tasks off this line
// and actually saves them to the database, so the redirect itself doesn't have to wait.

import { Queue } from 'bullmq'; // Bring in the 'Queue' tool from BullMQ — it manages a waiting line of jobs
import { redisConnection } from '../redis/client'; // Bring in the Redis address so the queue knows where to store its waiting line

export interface ClickJobData { // Describe the shape of information every "click" job must carry
  slug: string; // Each job must include which short link (slug) was clicked
} // End of the shape description

export const clickQueue = new Queue<ClickJobData>('clicks', { // Create a queue named 'clicks' that only holds jobs shaped like ClickJobData, and share it
  connection: redisConnection, // Tell the queue which Redis server to use for storing its waiting line
}); // End of the queue setup

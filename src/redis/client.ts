// This is the client.ts file (inside redis/). What this file does is connect to Redis,
// a very fast in-memory store used two ways in this app: as a cache (to answer redirects
// quickly without hitting Postgres every time) and as the connection BullMQ uses for its
// background job queue.

import Redis from 'ioredis'; // Bring in the 'Redis' tool from the 'ioredis' package — it lets us talk to a Redis server

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'; // Read the Redis address from the environment, or use a local default if none is set

export const redis = new Redis(redisUrl); // Open a real connection to Redis using that address, and make it available to other files

redis.on('error', (err) => { // Whenever the Redis connection has a problem, run this
  console.error('Redis error:', err); // Print the problem to the console so we can see what went wrong
}); // End of the error handler

export const redisConnection = { url: redisUrl }; // Package the same address into an object shape that BullMQ expects, and share it

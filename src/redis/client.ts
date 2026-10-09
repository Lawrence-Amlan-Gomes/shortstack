import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(redisUrl);

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

// BullMQ needs parsed host and TLS options plus unlimited retries for blocking reads.
export const redisConnection = { ...redis.options, maxRetriesPerRequest: null };

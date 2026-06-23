import { Queue } from 'bullmq';
import { redisConnection } from '../redis/client';

export interface ClickJobData {
  slug: string;
}

export const clickQueue = new Queue<ClickJobData>('clicks', {
  connection: redisConnection,
});

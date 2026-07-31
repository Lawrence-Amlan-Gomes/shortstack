import 'dotenv/config';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import { linkRouter, resolveSlug } from './routes/links';
import { authRouter } from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { clickQueue } from './queues/clickQueue';

const skipInTest = () => process.env.NODE_ENV === 'test';

const createLinkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many links created, please try again later.' },
  skip: skipInTest,
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later.' },
  skip: skipInTest,
});

export const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? '*',
  credentials: true,
}));
app.use(express.json());

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(clickQueue)], serverAdapter });
app.use('/admin/queues', basicAuth({
  users: { [process.env.BULL_BOARD_USER ?? 'admin']: process.env.BULL_BOARD_PASSWORD ?? '' },
  challenge: true,
}), serverAdapter.getRouter());

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// bit.ly-style root redirect — shares resolveSlug with linkRouter's /:slug so caching
// and click recording aren't implemented twice.
app.get('/:slug', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;
  const result = await resolveSlug(slug);

  if (!result) {
    res.status(404).json({ error: 'link not found' });
    return;
  }

  res.setHeader('X-Cache', result.cacheStatus);
  res.redirect(301, result.url);
});

app.post('/api/links', createLinkLimiter);
app.use('/api/links', linkRouter);
app.post('/api/auth/register', authLimiter);
app.post('/api/auth/login', authLimiter);
app.post('/api/auth/refresh', authLimiter);
app.use('/api/auth', authRouter);

app.use(errorHandler);

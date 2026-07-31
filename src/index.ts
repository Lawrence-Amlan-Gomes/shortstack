import { app } from './app';
import { migrate } from './db/migrate';
import { startClickWorker } from './workers/clickWorker';

// Fail fast rather than silently booting with an insecure default secret.
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is not set — refusing to start');
  process.exit(1);
}

const PORT = process.env.PORT ?? 3000;

migrate()
  .then(() => {
    startClickWorker();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

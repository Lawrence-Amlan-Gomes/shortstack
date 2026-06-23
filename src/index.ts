import { app } from './app';
import { migrate } from './db/migrate';
import { startClickWorker } from './workers/clickWorker';

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

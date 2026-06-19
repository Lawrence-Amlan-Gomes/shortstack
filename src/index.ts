import { app } from './app';
import { migrate } from './db/migrate';

const PORT = process.env.PORT ?? 3000;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

import { mkdir } from 'node:fs/promises';
import { config } from './config.js';
import { pool } from './db.js';
import { createApp } from './app.js';

try {
  await pool.execute('SELECT 1');
  await mkdir(config.uploadDir, { recursive: true, mode: 0o700 });
  const app = createApp({ pool, config });
  const server = app.listen(config.port, () =>
    console.log(`Candidate API ready at http://localhost:${config.port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      server.close(async () => {
        app.locals.sessionStore.close();
        await pool.end();
        process.exit(0);
      });
    });
} catch (error) {
  console.error(
    'Could not start API. Check backend/.env and run npm run db:init. Error:',
    error.code || error.name,
  );
  await pool.end();
  process.exitCode = 1;
}

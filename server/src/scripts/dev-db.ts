import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

async function main() {
  try {
    await pg.initialise();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('not empty')) {
      console.log('Init note:', msg);
    }
  }

  await pg.start();
  try {
    await pg.createDatabase('swapu');
    console.log('Created PostgreSQL database: swapu');
  } catch {
    // Database already exists
  }

  console.log('PostgreSQL dev server running on postgresql://postgres:postgres@localhost:5432/swapu');

  const shutdown = async () => {
    console.log('Stopping embedded PostgreSQL...');
    await pg.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start embedded PostgreSQL:', err);
  process.exit(1);
});

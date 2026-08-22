/**
 * Runs a command with DATABASE_URL / DIRECT_URL for Neon PostgreSQL.
 * Usage: node scripts/with-db.mjs -- npx prisma db push
 */
import { spawn } from 'child_process';
import { config } from 'dotenv';
import { applyPrismaEnv } from './prisma-env.mjs';

config();

async function main() {
  const args = process.argv.slice(2);
  const sep = args.indexOf('--');
  const cmdArgs = sep >= 0 ? args.slice(sep + 1) : args;
  if (!cmdArgs.length) {
    console.error('Usage: node scripts/with-db.mjs -- <command> [args...]');
    process.exit(1);
  }

  const { hasRealDb } = applyPrismaEnv();
  if (!hasRealDb) {
    console.error(
      'DATABASE_URL must be a Neon PostgreSQL URL (postgresql://...), not memory/mongodb.\n' +
        'See .env.example'
    );
    process.exit(1);
  }

  const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

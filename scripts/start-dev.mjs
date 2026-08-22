import { spawn } from 'child_process';
import { config } from 'dotenv';
import { applyPrismaEnv } from './prisma-env.mjs';

config();

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main() {
  const env = process.env;
  const { hasRealDb } = applyPrismaEnv();
  if (!hasRealDb) {
    console.error(
      'DATABASE_URL must be a Neon PostgreSQL URL (postgresql://...).\n' +
        'Copy it from Neon → Connection details into .env (see .env.example).'
    );
    process.exit(1);
  }

  console.log('Generating Prisma client…');
  await run('npx', ['prisma', 'generate', '--no-engine'], env);
  console.log('Syncing Prisma schema to Neon PostgreSQL…');
  await run('npx', ['prisma', 'db', 'push'], env);
  await run('npx', ['tsx', 'prisma/seed.ts'], env);

  env.PORT = process.env.WEB_PORT || '3000';
  const next = spawn('npx', ['next', 'dev', '-p', env.PORT], {
    stdio: 'inherit',
    shell: true,
    env
  });

  const shutdown = () => {
    next.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  next.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

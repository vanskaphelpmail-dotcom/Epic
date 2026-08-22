import { spawn } from 'child_process';
import { applyPrismaEnv } from './prisma-env.mjs';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: process.env
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main() {
  const { hasRealDb } = applyPrismaEnv({ forGenerate: true });

  console.log('Generating Prisma client…');
  await run('npx', ['prisma', 'generate']);

  if (hasRealDb) {
    console.log('Applying Prisma migrations…');
    try {
      await run('npx', ['prisma', 'migrate', 'deploy']);
    } catch (err) {
      console.warn('migrate deploy failed; recovering 20260815110000_product_inventory_attributes…');
      try {
        await run('npx', [
          'prisma',
          'migrate',
          'resolve',
          '--rolled-back',
          '20260815110000_product_inventory_attributes'
        ]);
        await run('npx', ['prisma', 'migrate', 'deploy']);
      } catch (recoverErr) {
        console.warn(
          'Migration recovery skipped (already applied or not in a failed state):',
          recoverErr instanceof Error ? recoverErr.message : recoverErr
        );
      }
    }
    if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
      console.log('Ensuring shop admin account…');
      await run('npx', ['tsx', 'scripts/ensure-admin.ts']);
    }
  } else {
    console.warn(
      'Skipping prisma migrate deploy: DATABASE_URL / Neon aliases are not set.'
    );
  }

  console.log('Building Next.js…');
  await run('npx', ['next', 'build']);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

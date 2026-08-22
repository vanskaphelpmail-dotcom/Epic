import { spawn } from 'child_process';
import { applyPrismaEnv } from './prisma-env.mjs';

applyPrismaEnv({ forGenerate: true });

const child = spawn('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

child.on('exit', (code) => process.exit(code ?? 0));

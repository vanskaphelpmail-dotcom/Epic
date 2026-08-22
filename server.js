/**
 * Legacy Express + Mongoose API — retired.
 * The Next.js App Router (app/api/*) is the only supported backend.
 */
console.error(`
The legacy Express/MongoDB API (server.js) has been retired.
Use Next.js instead:

  npm run dev     # local
  npm run build && npm start

All APIs live under /api via Prisma + Neon PostgreSQL.
`);
process.exit(1);

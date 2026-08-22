module.exports = async function ensureAdmin() {
  throw new Error(
    'Legacy ensureAdmin (Mongoose) is retired. Run: npm run seed (Prisma + Neon).'
  );
};

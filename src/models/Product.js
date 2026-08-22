module.exports = new Proxy({}, { get() { throw new Error('Legacy Mongoose model ''Product'' retired. Use Prisma Client via services/*.'); } });


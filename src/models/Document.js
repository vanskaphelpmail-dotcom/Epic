module.exports = new Proxy({}, { get() { throw new Error('Legacy Mongoose model ''Document'' retired. Use Prisma Client via services/*.'); } });


module.exports = new Proxy({}, { get() { throw new Error('Legacy Mongoose model ''Order'' retired. Use Prisma Client via services/*.'); } });


module.exports = new Proxy({}, { get() { throw new Error('Legacy Mongoose model ''Activity'' retired. Use Prisma Client via services/*.'); } });


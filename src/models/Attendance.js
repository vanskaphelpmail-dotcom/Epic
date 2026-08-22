module.exports = new Proxy({}, { get() { throw new Error('Legacy Mongoose model ''Attendance'' retired. Use Prisma Client via services/*.'); } });


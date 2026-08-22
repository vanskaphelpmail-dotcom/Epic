module.exports = new Proxy({}, { get() { throw new Error('Legacy Mongoose model ''Payroll'' retired. Use Prisma Client via services/*.'); } });


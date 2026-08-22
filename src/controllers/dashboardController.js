const Product = require('../models/Product'); const Order = require('../models/Order'); const Attendance = require('../models/Attendance'); const Payroll = require('../models/Payroll'); const Activity = require('../models/Activity');
exports.summary = async (req, res) => { const start = new Date(); start.setHours(0,0,0,0); const week = new Date(start); week.setDate(week.getDate() - 6); const [todaySales, stock, lowStock, clocked, dues, recentOrders, activities, weekly] = await Promise.all([
  Order.aggregate([{ $match: { createdAt: { $gte: start }, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
  Product.aggregate([{ $group: { _id: null, total: { $sum: { $multiply: ['$price', '$quantity'] } } } }]), Product.find({ $expr: { $lte: ['$quantity', '$lowStockThreshold'] } }).limit(10),
  Attendance.countDocuments({ date: { $gte: start }, clockIn: { $exists: true }, clockOut: null }), Payroll.aggregate([{ $group: { _id: null, due: { $sum: { $subtract: ['$grossAmount', '$paidAmount'] } } } }]),
  Order.find().sort({ createdAt: -1 }).limit(4), Activity.find().populate('user', 'name').sort({ createdAt: -1 }).limit(5),
  Order.aggregate([{ $match: { createdAt: { $gte: week }, status: { $ne: 'cancelled' } } }, { $group: { _id: { $dayOfWeek: '$createdAt' }, total: { $sum: '$total' } } }, { $sort: { '_id': 1 } }])
 ]);
 res.json({ success: true, data: { todaySales: todaySales[0]?.total || 0, todayOrderCount: todaySales[0]?.count || 0, stockValue: stock[0]?.total || 0, lowStock, clockedIn: clocked, pendingDues: dues[0]?.due || 0, recentOrders, activities, weeklySales: weekly } }); };

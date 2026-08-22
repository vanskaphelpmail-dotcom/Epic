const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Document = require('../models/Document');
const Activity = require('../models/Activity');

const models = { products: Product, orders: Order, employees: User, attendance: Attendance, payroll: Payroll, documents: Document };
const populated = { orders: 'items.product createdBy', attendance: 'user', payroll: 'user', documents: 'uploadedBy', employees: '' };
const log = (user, action, entity, entityId) => Activity.create({ user: user._id, action, entity, entityId });
const requireModel = resource => { if (!models[resource]) { const error = new Error('Unknown API resource'); error.statusCode = 404; throw error; } return models[resource]; };
exports.list = async (req, res) => { const Model = requireModel(req.params.resource); const q = req.query.q ? { $or: ['name', 'sku', 'orderNumber', 'email', 'title'].map(field => ({ [field]: { $regex: req.query.q, $options: 'i' } })) } : {}; let query = Model.find(q).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 100)); if (populated[req.params.resource]) query = query.populate(populated[req.params.resource]); res.json({ success: true, data: await query }); };
exports.get = async (req, res) => { let query = requireModel(req.params.resource).findById(req.params.id); if (populated[req.params.resource]) query = query.populate(populated[req.params.resource]); const data = await query; if (!data) return res.status(404).json({ success: false, message: 'Record not found' }); res.json({ success: true, data }); };
exports.create = async (req, res) => { const resource = req.params.resource; const data = await requireModel(resource).create(resource === 'attendance' ? { ...req.body, user: req.body.user || req.user._id } : req.body); await log(req.user, 'created', resource, data._id); res.status(201).json({ success: true, data }); };
exports.update = async (req, res) => { const data = await requireModel(req.params.resource).findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!data) return res.status(404).json({ success: false, message: 'Record not found' }); await log(req.user, 'updated', req.params.resource, data._id); res.json({ success: true, data }); };
exports.remove = async (req, res) => { const data = await requireModel(req.params.resource).findByIdAndDelete(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Record not found' }); await log(req.user, 'deleted', req.params.resource, data._id); res.status(204).end(); };
exports.stockMovement = async (req, res) => { const { quantity, type, note } = req.body; if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0 || !['in', 'out', 'adjustment'].includes(type)) return res.status(400).json({ success: false, message: 'Valid movement type and quantity are required' }); const product = await Product.findById(req.params.id); if (!product) return res.status(404).json({ success: false, message: 'Product not found' }); const delta = type === 'out' ? -Number(quantity) : Number(quantity); if (product.quantity + delta < 0) return res.status(400).json({ success: false, message: 'Insufficient stock' }); product.quantity += delta; product.stockHistory.push({ type, quantity: Number(quantity), note, user: req.user._id }); await product.save(); await log(req.user, `stock_${type}`, 'products', product._id); res.json({ success: true, data: product }); };
exports.clock = async (req, res) => { const start = new Date(); start.setHours(0, 0, 0, 0); let record = await Attendance.findOne({ user: req.user._id, date: { $gte: start } }); if (!record) { record = await Attendance.create({ user: req.user._id, clockIn: new Date() }); return res.status(201).json({ success: true, data: record, message: 'Clocked in' }); } if (!record.clockOut) { record.clockOut = new Date(); record.workMinutes = Math.round((record.clockOut - record.clockIn) / 60000); await record.save(); return res.json({ success: true, data: record, message: 'Clocked out' }); } return res.status(400).json({ success: false, message: 'Today’s attendance is already complete' }); };
exports.createOrder = async (req, res) => {
  const { items = [], customer = {}, discount = 0, paymentMethod = 'card', channel = 'POS' } = req.body;
  if (!items.length) return res.status(400).json({ success: false, message: 'At least one order item is required' });

  let subtotal = 0;
  const finalItems = [];
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product || product.quantity < item.quantity) {
      return res.status(400).json({ success: false, message: 'Stock unavailable for an order item' });
    }
    product.quantity -= item.quantity;
    product.stockHistory.push({ type: 'out', quantity: item.quantity, note: 'POS sale', user: req.user._id });
    await product.save();
    subtotal += product.price * item.quantity;
    finalItems.push({ product: product._id, name: product.name, quantity: item.quantity, price: product.price });
  }

  const safeDiscount = Math.max(0, Number(discount) || 0);
  const net = Math.max(0, subtotal - safeDiscount);
  const taxRate = 0.2; // UK-style VAT
  const tax = Number((net * taxRate).toFixed(2));
  const total = Number((net + tax).toFixed(2));

  const order = await Order.create({
    customer,
    items: finalItems,
    subtotal,
    discount: safeDiscount,
    taxRate,
    tax,
    total,
    currency: 'GBP',
    channel,
    status: 'completed',
    paymentStatus: 'paid',
    paymentMethod,
    createdBy: req.user._id
  });

  await log(req.user, 'created', 'orders', order._id);
  res.status(201).json({ success: true, data: order, message: 'Invoice created' });
};

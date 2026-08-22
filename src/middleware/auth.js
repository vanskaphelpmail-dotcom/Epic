const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required' });
  const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  const user = await User.findById(payload.id).select('-password');
  if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Account is unavailable' });
  req.user = user;
  next();
};

exports.allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'You do not have permission for this action' });
  next();
};

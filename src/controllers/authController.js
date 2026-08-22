const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sign = user => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
exports.login = async (req, res) => { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' }); const user = await User.findOne({ email: email.toLowerCase() }).select('+password'); if (!user || !(await user.comparePassword(password)) || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid email or password' }); const safeUser = user.toObject(); delete safeUser.password; res.json({ success: true, token: sign(user), user: safeUser }); };
exports.me = async (req, res) => res.json({ success: true, user: req.user });
exports.createUser = async (req, res) => { const user = await User.create(req.body); const safeUser = user.toObject(); delete safeUser.password; res.status(201).json({ success: true, user: safeUser }); };
exports.logout = async (req, res) => res.json({ success: true, message: 'Logged out' });

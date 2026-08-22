module.exports = (error, req, res, next) => {
  console.error(error);
  if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid session' });
  if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(error.errors).map(x => x.message).join(', ') });
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'A record with this value already exists' });
  res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Something went wrong' });
};

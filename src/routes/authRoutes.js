const router = require('express').Router(); const c = require('../controllers/authController'); const { protect, allow } = require('../middleware/auth');
router.post('/login', c.login); router.post('/logout', c.logout); router.get('/me', protect, c.me); router.post('/users', protect, allow('admin', 'manager'), c.createUser); module.exports = router;

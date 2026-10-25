const router = require('express').Router();
const { authLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { register, login, logout, me, updateProfile } = require('../controllers/authController');
const { wrap } = require('../middleware/errors');

router.post('/register', authLimiter, wrap(register));
router.post('/login', authLimiter, wrap(login));
router.post('/logout', wrap(logout));
router.get('/me', requireAuth, wrap(me));
router.patch('/me', requireAuth, wrap(updateProfile));

module.exports = router;

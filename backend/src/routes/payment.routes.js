const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

router.use(requireAuth);
router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.get('/entitlements', paymentController.getEntitlements);

module.exports = router;

const crypto = require('node:crypto');
const feePlanRepository = require('../db/fee-plan.repository');
const razorpayClient = require('../services/razorpay.client');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRazorpayConfig() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured. Set server-side credentials first.');
  }
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    throw new Error('Razorpay key ID is malformed.');
  }
  if (keyId.startsWith('rzp_live_') && process.env.RAZORPAY_ALLOW_LIVE !== 'true') {
    throw new Error('Live Razorpay checkout is disabled until explicitly enabled.');
  }
  return { keyId, keySecret, client: razorpayClient.createClient(keyId, keySecret) };
}

function isValidSignature(orderId, paymentId, signature, secret) {
  if (typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  const provided = Buffer.from(signature, 'hex');
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function logPaymentError(stage, error, requestId) {
  console.error('Fee plan payment request failed.', {
    module: 'payment',
    stage,
    requestId,
    error: error.message,
  });
}

async function createOrder(req, res) {
  const feePlanId = typeof req.body?.feePlanId === 'string' ? req.body.feePlanId : '';
  const durationMonths = Number(req.body?.durationMonths);
  if (!UUID_PATTERN.test(feePlanId) || !Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 120) {
    return res.status(400).json({ message: 'Select a valid fee plan and duration.' });
  }

  let planPrice;
  try {
    planPrice = await feePlanRepository.getPublishedPlanPrice(feePlanId, durationMonths);
  } catch (error) {
    logPaymentError('load_plan_price', error, req.requestId);
    return res.status(503).json({ message: 'Could not load the selected plan price.' });
  }
  if (!planPrice) {
    return res.status(404).json({ message: 'The selected fee plan or duration is no longer available.' });
  }
  if (planPrice.paymentMode !== 'One-time') {
    return res.status(400).json({
      message: 'Installments and subscriptions are not supported by this Razorpay checkout yet.',
    });
  }

  let config;
  try {
    config = getRazorpayConfig();
  } catch (error) {
    logPaymentError('configuration', error, req.requestId);
    return res.status(503).json({ message: error.message });
  }

  const amount = Math.round(planPrice.offerPrice * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return res.status(400).json({ message: 'The selected plan has an invalid offer price.' });
  }

  try {
    const order = await config.client.orders.create({
      amount,
      currency: 'INR',
      receipt: `fp-${crypto.randomUUID()}`,
      notes: {
        userId: req.user.id,
        feePlanId: planPrice.id,
        durationMonths: String(planPrice.months),
      },
    });
    if (
      typeof order?.id !== 'string' ||
      order.amount !== amount ||
      order.currency !== 'INR'
    ) {
      throw new Error('Razorpay returned an order that does not match the selected plan price.');
    }
    await feePlanRepository.createPaymentOrder({
      razorpayOrderId: order.id,
      userId: req.user.id,
      feePlanId: planPrice.id,
      planName: planPrice.name,
      productIds: planPrice.productIds,
      durationMonths: planPrice.months,
      actualPrice: planPrice.actualPrice,
      offerPrice: planPrice.offerPrice,
      amount: order.amount,
      currency: order.currency,
    });
    return res.status(201).json({
      keyId: config.keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      feePlanId: planPrice.id,
      durationMonths: planPrice.months,
      actualPrice: planPrice.actualPrice,
      offerPrice: planPrice.offerPrice,
    });
  } catch (error) {
    logPaymentError('create_order', error, req.requestId);
    return res.status(503).json({ message: 'Could not create the payment order. Please try again.' });
  }
}

async function verifyPayment(req, res) {
  const orderId = req.body?.razorpay_order_id;
  const paymentId = req.body?.razorpay_payment_id;
  const signature = req.body?.razorpay_signature;
  if (
    typeof orderId !== 'string' || !orderId ||
    typeof paymentId !== 'string' || !paymentId ||
    typeof signature !== 'string' || !signature
  ) {
    return res.status(400).json({ message: 'Razorpay payment verification details are incomplete.' });
  }

  let order;
  try {
    order = await feePlanRepository.getPaymentOrder(orderId, req.user.id);
  } catch (error) {
    logPaymentError('load_order', error, req.requestId);
    return res.status(503).json({ message: 'Could not load the payment order.' });
  }
  if (!order) return res.status(404).json({ message: 'Payment order not found.' });

  if (order.status === 'captured') {
    if (order.razorpayPaymentId !== paymentId) {
      return res.status(409).json({ message: 'This order has already been verified.' });
    }
    try {
      return res.json({
        success: true,
        entitlement: (await feePlanRepository.getUserEntitlements(req.user.id))
          .find((item) => item.planId === order.feePlanId && item.planName === order.planName) || null,
      });
    } catch (error) {
      logPaymentError('load_existing_entitlement', error, req.requestId);
      return res.status(503).json({ message: 'Payment was verified, but the purchase could not be loaded.' });
    }
  }
  if (order.status !== 'created') {
    return res.status(409).json({ message: 'This order cannot be verified.' });
  }

  let config;
  try {
    config = getRazorpayConfig();
  } catch (error) {
    logPaymentError('verification_configuration', error, req.requestId);
    return res.status(503).json({ message: error.message });
  }
  if (!isValidSignature(orderId, paymentId, signature, config.keySecret)) {
    return res.status(400).json({ message: 'Payment signature verification failed.' });
  }

  let payment;
  try {
    payment = await config.client.payments.fetch(paymentId);
    if (
      payment.order_id !== orderId ||
      payment.amount !== order.amount ||
      payment.currency !== order.currency ||
      payment.status !== 'captured'
    ) {
      return res.status(400).json({ message: 'Payment is not captured for this order.' });
    }
  } catch (error) {
    logPaymentError('provider_verification', error, req.requestId);
    return res.status(502).json({ message: 'Could not verify payment with Razorpay. Please retry verification.' });
  }

  try {
    const result = await feePlanRepository.recordCapturedPayment({
      razorpayOrderId: orderId,
      userId: req.user.id,
      payment,
    });
    if (result.outcome === 'not_found') {
      return res.status(404).json({ message: 'Payment order not found.' });
    }
    if (result.outcome === 'conflict') {
      return res.status(409).json({ message: 'This order has already been verified.' });
    }
    return res.json({ success: true, entitlement: result.entitlement });
  } catch (error) {
    logPaymentError('persist_captured_payment', error, req.requestId);
    return res.status(503).json({ message: 'Payment was verified but could not be saved. Please retry verification.' });
  }
}

async function getEntitlements(req, res) {
  try {
    return res.json({ entitlements: await feePlanRepository.getUserEntitlements(req.user.id) });
  } catch (error) {
    logPaymentError('get_entitlements', error, req.requestId);
    return res.status(503).json({ message: 'Could not load your purchased plans.' });
  }
}

module.exports = { createOrder, verifyPayment, getEntitlements, isValidSignature };

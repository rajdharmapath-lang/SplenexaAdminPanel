const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const feePlanRepository = require('../src/db/fee-plan.repository');
const razorpayClient = require('../src/services/razorpay.client');
const controller = require('../src/controllers/payment.controller');

const planId = '9a6cfdf0-3fc7-4e31-865a-a6fc875df210';

function createResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function setEnvironment(name, value) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  };
}

test('payment signatures must match the Razorpay order and payment IDs', () => {
  const signature = crypto.createHmac('sha256', 'secret')
    .update('order-1|payment-1')
    .digest('hex');
  assert.equal(controller.isValidSignature('order-1', 'payment-1', signature, 'secret'), true);
  assert.equal(controller.isValidSignature('order-1', 'payment-2', signature, 'secret'), false);
  assert.equal(controller.isValidSignature('order-1', 'payment-1', 'invalid', 'secret'), false);
});

test('create order takes its price from the published database plan, not the client', async () => {
  const restoreKeyId = setEnvironment('RAZORPAY_KEY_ID', 'rzp_test_unit');
  const restoreSecret = setEnvironment('RAZORPAY_KEY_SECRET', 'unit-secret');
  const restoreLive = setEnvironment('RAZORPAY_ALLOW_LIVE', undefined);
  const storedOrders = [];
  let providerOrder;
  mock.method(feePlanRepository, 'getPublishedPlanPrice', async () => ({
    id: planId,
    name: 'Foundation',
    productIds: ['product-1'],
    paymentMode: 'One-time',
    months: 3,
    actualPrice: 1500,
    offerPrice: 499,
  }));
  mock.method(feePlanRepository, 'createPaymentOrder', async (order) => storedOrders.push(order));
  mock.method(razorpayClient, 'createClient', (keyId, keySecret) => {
    assert.equal(keyId, 'rzp_test_unit');
    assert.equal(keySecret, 'unit-secret');
    return {
      orders: {
        create: async (order) => {
          providerOrder = order;
          return { id: 'order_test_1', amount: order.amount, currency: order.currency };
        },
      },
    };
  });
  const response = createResponse();

  try {
    await controller.createOrder({
      user: { id: 'user-id' },
      requestId: 'request-id',
      body: { feePlanId: planId, durationMonths: 3, amount: 1 },
    }, response);
    assert.equal(response.statusCode, 201);
    assert.equal(providerOrder.amount, 49900);
    assert.equal(providerOrder.currency, 'INR');
    assert.equal(storedOrders[0].amount, 49900);
    assert.equal(storedOrders[0].actualPrice, 1500);
    assert.equal(storedOrders[0].offerPrice, 499);
    assert.equal(response.body.keyId, 'rzp_test_unit');
  } finally {
    mock.restoreAll();
    restoreKeyId();
    restoreSecret();
    restoreLive();
  }
});

test('create order rejects payment modes not supported by one-time Razorpay checkout', async () => {
  mock.method(feePlanRepository, 'getPublishedPlanPrice', async () => ({
    id: planId,
    name: 'Foundation',
    productIds: ['product-1'],
    paymentMode: 'Subscription',
    months: 3,
    actualPrice: 1500,
    offerPrice: 499,
  }));
  const response = createResponse();

  try {
    await controller.createOrder({
      user: { id: 'user-id' },
      body: { feePlanId: planId, durationMonths: 3 },
    }, response);
    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /not supported/);
  } finally {
    mock.restoreAll();
  }
});

test('create order rejects a Razorpay order that does not match the plan price', async () => {
  const restoreKeyId = setEnvironment('RAZORPAY_KEY_ID', 'rzp_test_unit');
  const restoreSecret = setEnvironment('RAZORPAY_KEY_SECRET', 'unit-secret');
  const restoreLive = setEnvironment('RAZORPAY_ALLOW_LIVE', undefined);
  const savedOrders = [];
  mock.method(feePlanRepository, 'getPublishedPlanPrice', async () => ({
    id: planId,
    name: 'Foundation',
    productIds: ['product-1'],
    paymentMode: 'One-time',
    months: 3,
    actualPrice: 1500,
    offerPrice: 499,
  }));
  mock.method(feePlanRepository, 'createPaymentOrder', async (order) => savedOrders.push(order));
  mock.method(razorpayClient, 'createClient', () => ({
    orders: { create: async () => ({ id: 'order_test_1', amount: 1, currency: 'INR' }) },
  }));
  const response = createResponse();

  try {
    await controller.createOrder({
      user: { id: 'user-id' },
      body: { feePlanId: planId, durationMonths: 3 },
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(savedOrders.length, 0);
  } finally {
    mock.restoreAll();
    restoreKeyId();
    restoreSecret();
    restoreLive();
  }
});

test('create order rejects malformed plan IDs before database or provider calls', async () => {
  const repositoryStub = mock.method(feePlanRepository, 'getPublishedPlanPrice', async () => {
    throw new Error('Should not query the database.');
  });
  const response = createResponse();

  try {
    await controller.createOrder({
      user: { id: 'user-id' },
      body: { feePlanId: 'client-supplied-price', durationMonths: 3 },
    }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(repositoryStub.mock.callCount(), 0);
  } finally {
    mock.restoreAll();
  }
});

test('verify records only a provider-confirmed captured payment', async () => {
  const restoreKeyId = setEnvironment('RAZORPAY_KEY_ID', 'rzp_test_unit');
  const restoreSecret = setEnvironment('RAZORPAY_KEY_SECRET', 'unit-secret');
  const payment = {
    id: 'pay_test_1',
    order_id: 'order_test_1',
    amount: 49900,
    currency: 'INR',
    status: 'captured',
    method: 'upi',
    created_at: 1730000000,
  };
  const signature = crypto.createHmac('sha256', 'unit-secret')
    .update('order_test_1|pay_test_1')
    .digest('hex');
  const entitlement = { planId, planName: 'Foundation', durationMonths: 3 };
  const recorded = [];
  mock.method(feePlanRepository, 'getPaymentOrder', async () => ({
    amount: 49900,
    currency: 'INR',
    status: 'created',
  }));
  mock.method(feePlanRepository, 'recordCapturedPayment', async (value) => {
    recorded.push(value);
    return { outcome: 'captured', entitlement };
  });
  mock.method(razorpayClient, 'createClient', () => ({
    payments: { fetch: async () => payment },
  }));
  const response = createResponse();

  try {
    await controller.verifyPayment({
      user: { id: 'user-id' },
      body: {
        razorpay_order_id: 'order_test_1',
        razorpay_payment_id: 'pay_test_1',
        razorpay_signature: signature,
      },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { success: true, entitlement });
    assert.equal(recorded[0].payment.status, 'captured');
  } finally {
    mock.restoreAll();
    restoreKeyId();
    restoreSecret();
  }
});

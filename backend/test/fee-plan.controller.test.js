const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const repository = require('../src/db/fee-plan.repository');
const controller = require('../src/controllers/fee-plan.controller');

const validPlan = {
  name: 'Foundation',
  description: 'Build your MCQ knowledge',
  productIds: ['product-1'],
  productSubjects: {},
  productTests: {},
  pricingOptions: [
    { months: 3, actualPrice: 1500, offerPrice: 499 },
    { months: 6, actualPrice: 3000, offerPrice: 999 },
  ],
  paymentMode: 'One-time payment',
  status: 'Published',
};

function createResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('fee plan normalization keeps actual and offer prices and normalizes payment mode', () => {
  const result = controller.normalizePlan(validPlan);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.plan.pricingOptions, validPlan.pricingOptions);
  assert.equal(result.plan.paymentMode, 'One-time');
});

test('fee plan normalization rejects offer prices above actual prices', () => {
  const result = controller.normalizePlan({
    ...validPlan,
    pricingOptions: [{ months: 3, actualPrice: 499, offerPrice: 500 }],
  });
  assert.equal(result.error, 'Offer price cannot be greater than actual price.');
});

test('admin save persists and returns the plan with its actual and offer prices', async () => {
  let saved;
  mock.method(repository, 'savePlan', async (plan) => {
    saved = plan;
    return { ...plan, id: '9a6cfdf0-3fc7-4e31-865a-a6fc875df210' };
  });
  const response = createResponse();

  try {
    await controller.saveAdminPlan({ body: validPlan, params: {} }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 201);
    assert.deepEqual(saved.pricingOptions, validPlan.pricingOptions);
    assert.equal(response.body.plan.pricingOptions[0].actualPrice, 1500);
    assert.equal(response.body.plan.pricingOptions[0].offerPrice, 499);
  } finally {
    mock.restoreAll();
  }
});

test('public plan list returns only repository-published plan data', async () => {
  const plans = [{ id: 'published-plan', status: 'Published', pricingOptions: validPlan.pricingOptions }];
  mock.method(repository, 'getPublishedPlans', async () => plans);
  const response = createResponse();

  try {
    await controller.getPublicPlans({}, response, (error) => { throw error; });
    assert.deepEqual(response.body, { plans });
  } finally {
    mock.restoreAll();
  }
});

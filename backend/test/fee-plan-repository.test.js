const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const supabase = require('../src/db/supabase');
const repository = require('../src/db/fee-plan.repository');

const planId = '9a6cfdf0-3fc7-4e31-865a-a6fc875df210';
const storedPlan = {
  id: planId,
  name: 'Foundation',
  description: 'Build your MCQ knowledge',
  product_ids: ['product-1'],
  product_subjects: {},
  product_tests: {},
  payment_mode: 'One-time',
  status: 'Published',
  created_at: '2026-11-28T00:00:00.000Z',
  updated_at: '2026-11-28T00:00:00.000Z',
};
const storedPrice = {
  fee_plan_id: planId,
  duration_months: 3,
  actual_price: '1500.00',
  offer_price: '499.00',
};

function createListQuery(data) {
  const query = {
    select() { return this; },
    order() { return this; },
    eq() { return this; },
    in() { return this; },
    then(resolve, reject) {
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return query;
}

test('admin plan read maps separate database prices to actual and offer values', async () => {
  const client = {
    from(table) {
      return table === 'fee_plans'
        ? createListQuery([storedPlan])
        : createListQuery([storedPrice]);
    },
  };
  mock.method(supabase, 'getClient', () => client);

  try {
    const [plan] = await repository.getAdminPlans();
    assert.equal(plan.id, planId);
    assert.equal(plan.pricingOptions[0].actualPrice, 1500);
    assert.equal(plan.pricingOptions[0].offerPrice, 499);
    assert.equal(plan.pricingOptions[0].price, 499);
    assert.equal(plan.baseFee, 499);
  } finally {
    mock.restoreAll();
  }
});

test('plan save writes durations and both prices through the transaction RPC', async () => {
  let rpcCall;
  const client = {
    rpc: async (name, parameters) => {
      rpcCall = { name, parameters };
      return { data: planId, error: null };
    },
    from(table) {
      return table === 'fee_plans'
        ? createListQuery([storedPlan])
        : createListQuery([storedPrice]);
    },
  };
  mock.method(supabase, 'getClient', () => client);
  const plan = {
    name: 'Foundation',
    description: 'Build your MCQ knowledge',
    productIds: ['product-1'],
    productSubjects: {},
    productTests: {},
    paymentMode: 'One-time',
    status: 'Published',
    pricingOptions: [{ months: 3, actualPrice: 1500, offerPrice: 499 }],
  };

  try {
    await repository.savePlan(plan);
    assert.equal(rpcCall.name, 'save_fee_plan');
    assert.deepEqual(rpcCall.parameters.p_pricing_options, plan.pricingOptions);
    assert.equal(rpcCall.parameters.p_id, null);
    assert.equal(rpcCall.parameters.p_product_ids[0], 'product-1');
  } finally {
    mock.restoreAll();
  }
});

test('payment order persistence stores the selected prices from the server', async () => {
  let inserted;
  const query = {
    insert(value) {
      inserted = value;
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    },
  };
  mock.method(supabase, 'getClient', () => ({ from: () => query }));

  try {
    await repository.createPaymentOrder({
      razorpayOrderId: 'order_test_1',
      userId: 'user-id',
      feePlanId: planId,
      planName: 'Foundation',
      productIds: ['product-1'],
      durationMonths: 3,
      actualPrice: 1500,
      offerPrice: 499,
      amount: 49900,
      currency: 'INR',
    });
    assert.equal(inserted.actual_price, 1500);
    assert.equal(inserted.offer_price, 499);
    assert.equal(inserted.amount, 49900);
  } finally {
    mock.restoreAll();
  }
});

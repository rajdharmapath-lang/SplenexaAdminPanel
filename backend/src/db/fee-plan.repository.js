const supabase = require('./supabase');

async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function mapPlan(row, prices) {
  const pricingOptions = prices.map((price) => ({
    months: price.duration_months,
    actualPrice: Number(price.actual_price),
    offerPrice: Number(price.offer_price),
    price: Number(price.offer_price),
  }));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    productIds: row.product_ids,
    productSubjects: row.product_subjects,
    productTests: row.product_tests,
    pricingOptions,
    baseFee: pricingOptions[0]?.offerPrice || 0,
    discount: 0,
    validity: pricingOptions[0] ? pricingOptions[0].months * 30 : 0,
    paymentMode: row.payment_mode,
    activation: 'After payment verification',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getPlans(publishedOnly) {
  const client = supabase.getClient();
  let planQuery = client.from('fee_plans').select('*').order('created_at', { ascending: false });
  if (publishedOnly) planQuery = planQuery.eq('status', 'Published');
  const rows = await unwrap(planQuery);
  if (!rows.length) return [];

  const prices = await unwrap(
    client.from('fee_plan_prices')
      .select('fee_plan_id, duration_months, actual_price, offer_price')
      .in('fee_plan_id', rows.map((row) => row.id))
      .order('duration_months', { ascending: true }),
  );
  const pricesByPlan = new Map(rows.map((row) => [row.id, []]));
  prices.forEach((price) => pricesByPlan.get(price.fee_plan_id)?.push(price));
  return rows.map((row) => mapPlan(row, pricesByPlan.get(row.id) || []));
}

async function getAdminPlans() {
  return getPlans(false);
}

async function getPublishedPlans() {
  return getPlans(true);
}

async function savePlan(plan) {
  const { data: id, error } = await supabase.getClient().rpc('save_fee_plan', {
    p_id: plan.id || null,
    p_name: plan.name,
    p_description: plan.description,
    p_product_ids: plan.productIds,
    p_product_subjects: plan.productSubjects,
    p_product_tests: plan.productTests,
    p_payment_mode: plan.paymentMode,
    p_status: plan.status,
    p_pricing_options: plan.pricingOptions,
  });
  if (error) throw error;

  const savedPlan = (await getAdminPlans()).find((item) => item.id === id);
  if (!savedPlan) throw new Error('Saved fee plan could not be reloaded.');
  return savedPlan;
}

async function deletePlan(planId) {
  const result = await supabase.getClient().from('fee_plans')
    .delete()
    .eq('id', planId)
    .select('id')
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function getPublishedPlanPrice(planId, durationMonths) {
  const client = supabase.getClient();
  const plan = await unwrap(
    client.from('fee_plans')
      .select('id, name, product_ids, payment_mode, status')
      .eq('id', planId)
      .eq('status', 'Published')
      .maybeSingle(),
  );
  if (!plan) return null;

  const price = await unwrap(
    client.from('fee_plan_prices')
      .select('duration_months, actual_price, offer_price')
      .eq('fee_plan_id', planId)
      .eq('duration_months', durationMonths)
      .maybeSingle(),
  );
  if (!price) return null;
  return {
    id: plan.id,
    name: plan.name,
    productIds: plan.product_ids,
    paymentMode: plan.payment_mode,
    months: price.duration_months,
    actualPrice: Number(price.actual_price),
    offerPrice: Number(price.offer_price),
  };
}

async function createPaymentOrder(order) {
  const result = await supabase.getClient().from('payment_orders').insert({
    razorpay_order_id: order.razorpayOrderId,
    user_id: order.userId,
    fee_plan_id: order.feePlanId,
    plan_name: order.planName,
    product_ids: order.productIds,
    duration_months: order.durationMonths,
    actual_price: order.actualPrice,
    offer_price: order.offerPrice,
    amount: order.amount,
    currency: order.currency,
  });
  if (result.error) throw result.error;
}

async function getPaymentOrder(razorpayOrderId, userId) {
  const row = await unwrap(
    supabase.getClient().from('payment_orders')
      .select('*')
      .eq('razorpay_order_id', razorpayOrderId)
      .eq('user_id', userId)
      .maybeSingle(),
  );
  if (!row) return null;
  return {
    id: row.id,
    razorpayOrderId: row.razorpay_order_id,
    userId: row.user_id,
    feePlanId: row.fee_plan_id,
    planName: row.plan_name,
    productIds: row.product_ids,
    durationMonths: row.duration_months,
    actualPrice: Number(row.actual_price),
    offerPrice: Number(row.offer_price),
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    razorpayPaymentId: row.razorpay_payment_id,
  };
}

async function recordCapturedPayment({ razorpayOrderId, userId, payment }) {
  const razorpayCreatedAt = Number.isFinite(payment.created_at)
    ? new Date(payment.created_at * 1000).toISOString()
    : null;
  const data = await unwrap(
    supabase.getClient().rpc('record_captured_fee_plan_payment', {
      p_razorpay_order_id: razorpayOrderId,
      p_user_id: userId,
      p_razorpay_payment_id: payment.id,
      p_amount: payment.amount,
      p_currency: payment.currency,
      p_method: payment.method || null,
      p_razorpay_created_at: razorpayCreatedAt,
    }),
  );
  const row = data.entitlement;
  return {
    outcome: data.outcome,
    entitlement: row ? {
      planId: row.fee_plan_id,
      planName: row.plan_name,
      productIds: row.product_ids,
      durationMonths: row.duration_months,
      purchasedAt: row.purchased_at,
      validUntil: row.valid_until,
    } : null,
  };
}

async function getUserEntitlements(userId) {
  const rows = await unwrap(
    supabase.getClient().from('fee_plan_entitlements')
      .select('fee_plan_id, plan_name, product_ids, duration_months, purchased_at, valid_until')
      .eq('user_id', userId)
      .gt('valid_until', new Date().toISOString())
      .order('valid_until', { ascending: false }),
  );
  return rows.map((row) => ({
    planId: row.fee_plan_id,
    planName: row.plan_name,
    productIds: row.product_ids,
    durationMonths: row.duration_months,
    purchasedAt: row.purchased_at,
    validUntil: row.valid_until,
  }));
}

async function getActiveEntitlementsForAdmin() {
  const rows = await unwrap(
    supabase.getClient().from('fee_plan_entitlements')
      .select('user_id, plan_name, product_ids')
      .gt('valid_until', new Date().toISOString())
      .order('valid_until', { ascending: false }),
  );
  return rows.map((row) => ({
    userId: row.user_id,
    planName: row.plan_name,
    productIds: row.product_ids,
  }));
}

module.exports = {
  getAdminPlans,
  getPublishedPlans,
  savePlan,
  deletePlan,
  getPublishedPlanPrice,
  createPaymentOrder,
  getPaymentOrder,
  recordCapturedPayment,
  getUserEntitlements,
  getActiveEntitlementsForAdmin,
};

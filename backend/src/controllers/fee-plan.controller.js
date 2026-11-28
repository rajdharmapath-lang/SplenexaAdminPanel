const feePlanRepository = require('../db/fee-plan.repository');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizePlan(body) {
  if (!isObject(body)) return { error: 'Fee plan data must be an object.' };
  if (body.id !== undefined && (typeof body.id !== 'string' || !UUID_PATTERN.test(body.id))) {
    return { error: 'Fee plan ID is invalid.' };
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const productIds = body.productIds;
  const productSubjects = body.productSubjects ?? {};
  const productTests = body.productTests ?? {};
  const paymentMode = body.paymentMode === 'One-time payment' ? 'One-time' : body.paymentMode;
  const status = body.status;
  if (!name || name.length > 100 || description.length > 300) {
    return { error: 'Enter a plan name up to 100 characters and a description up to 300 characters.' };
  }
  if (
    !Array.isArray(productIds) || productIds.length < 1 || productIds.length > 200 ||
    productIds.some((id) => typeof id !== 'string' || !id.trim()) ||
    new Set(productIds).size !== productIds.length
  ) {
    return { error: 'Add at least one valid, unique product to the fee plan.' };
  }
  if (!isObject(productSubjects) || !isObject(productTests)) {
    return { error: 'Fee plan product selections are invalid.' };
  }
  if (!['One-time', 'Installments', 'Subscription'].includes(paymentMode)) {
    return { error: 'Select a valid payment model.' };
  }
  if (!['Draft', 'Published'].includes(status)) {
    return { error: 'Select a valid fee plan status.' };
  }
  if (!Array.isArray(body.pricingOptions) || body.pricingOptions.length < 1 || body.pricingOptions.length > 24) {
    return { error: 'Add between 1 and 24 duration prices.' };
  }

  const pricingOptions = body.pricingOptions.map((option) => ({
    months: Number(option?.months),
    actualPrice: Number(option?.actualPrice),
    offerPrice: Number(option?.offerPrice),
  }));
  if (pricingOptions.some((option) =>
    !Number.isInteger(option.months) || option.months < 1 || option.months > 120 ||
    !Number.isFinite(option.actualPrice) || option.actualPrice < 0 ||
    !Number.isFinite(option.offerPrice) || option.offerPrice < 0 ||
    Math.round(option.actualPrice * 100) !== option.actualPrice * 100 ||
    Math.round(option.offerPrice * 100) !== option.offerPrice * 100
  )) {
    return { error: 'Enter valid duration, actual price, and offer price values.' };
  }
  if (pricingOptions.some((option) => option.offerPrice > option.actualPrice)) {
    return { error: 'Offer price cannot be greater than actual price.' };
  }
  if (new Set(pricingOptions.map((option) => option.months)).size !== pricingOptions.length) {
    return { error: 'Each plan duration must be unique.' };
  }
  if (status === 'Published' && pricingOptions.some((option) => option.actualPrice <= 0 || option.offerPrice <= 0)) {
    return { error: 'Set both prices above ₹0 for every duration before publishing this plan.' };
  }

  return {
    plan: {
      id: body.id,
      name,
      description,
      productIds,
      productSubjects,
      productTests,
      paymentMode,
      status,
      pricingOptions,
    },
  };
}

function isFeePlanSchemaMissing(error) {
  return ['42P01', 'PGRST205', 'PGRST202'].includes(error.code);
}

function sendMigrationRequired(res) {
  return res.status(503).json({
    message: 'Fee plan storage is not set up yet. Apply the fee plans and checkout migration in Supabase.',
  });
}

async function getPublicPlans(_req, res, next) {
  try {
    return res.json({ plans: await feePlanRepository.getPublishedPlans() });
  } catch (error) {
    if (isFeePlanSchemaMissing(error)) return sendMigrationRequired(res);
    return next(error);
  }
}

async function getAdminPlans(_req, res, next) {
  try {
    return res.json({ plans: await feePlanRepository.getAdminPlans() });
  } catch (error) {
    if (isFeePlanSchemaMissing(error)) return sendMigrationRequired(res);
    return next(error);
  }
}

async function saveAdminPlan(req, res, next) {
  const result = normalizePlan(req.body);
  if (result.error) return res.status(400).json({ message: result.error });
  if (req.params.id && req.params.id !== result.plan.id) {
    return res.status(400).json({ message: 'Fee plan ID does not match the request.' });
  }
  if (req.params.id && !UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ message: 'Fee plan ID is invalid.' });
  }

  try {
    const plan = await feePlanRepository.savePlan(result.plan);
    return res.status(result.plan.id ? 200 : 201).json({ plan });
  } catch (error) {
    if (isFeePlanSchemaMissing(error)) return sendMigrationRequired(res);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A fee plan already exists with that name.' });
    }
    if (error.code === '22023') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

async function deleteAdminPlan(req, res, next) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({ message: 'Fee plan ID is invalid.' });
  }
  try {
    const deleted = await feePlanRepository.deletePlan(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Fee plan not found.' });
    return res.json({ deleted: true });
  } catch (error) {
    if (isFeePlanSchemaMissing(error)) return sendMigrationRequired(res);
    return next(error);
  }
}

module.exports = {
  getPublicPlans,
  getAdminPlans,
  saveAdminPlan,
  deleteAdminPlan,
  normalizePlan,
};

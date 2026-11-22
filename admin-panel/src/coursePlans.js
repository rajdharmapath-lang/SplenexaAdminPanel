export const COURSE_PLANS_STORAGE_KEY = 'fmge-payment-plans';

export const DEFAULT_COURSE_PLANS = [
  { id: 'plan-a', name: 'PLAN A', productIds: ['image-based-test', 'video-library'], baseFee: 0, discount: 0, validity: 365, paymentMode: 'One-time', activation: 'After payment verification', status: 'Draft' },
  { id: 'plan-b', name: 'PLAN B', productIds: ['pdf-library', 'video-library'], baseFee: 0, discount: 0, validity: 365, paymentMode: 'One-time', activation: 'After payment verification', status: 'Draft' },
  { id: 'plan-c', name: 'PLAN C', productIds: ['pdf-library', 'image-based-test'], baseFee: 0, discount: 0, validity: 365, paymentMode: 'One-time', activation: 'After payment verification', status: 'Draft' }
];

export function readCoursePlans(storage) {
  const savedPlans = storage.getItem(COURSE_PLANS_STORAGE_KEY);
  if (savedPlans === null) return DEFAULT_COURSE_PLANS;

  const plans = JSON.parse(savedPlans);
  if (!Array.isArray(plans)) throw new TypeError('Saved course plans must be an array.');
  return plans.filter(plan => {
    if (plan && typeof plan.id === 'string' && typeof plan.name === 'string' && plan.name.trim()) return true;
    console.warn('Skipping an invalid saved course plan.', plan);
    return false;
  });
}

export function populateCoursePlanSelect(select, storage) {
  const plans = readCoursePlans(storage);
  select.replaceChildren();

  if (!plans.length) {
    const option = select.ownerDocument.createElement('option');
    option.disabled = true;
    option.textContent = 'No course plans available';
    select.appendChild(option);
    return plans;
  }

  plans.forEach(plan => {
    const option = select.ownerDocument.createElement('option');
    option.value = plan.id;
    option.textContent = plan.name;
    select.appendChild(option);
  });
  return plans;
}

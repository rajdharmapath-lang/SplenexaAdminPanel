const userRepository = require('../db/user.repository');
const feePlanRepository = require('../db/fee-plan.repository');
const questionBankRepository = require('../db/question-bank.repository');
const indianStates = require('../data/indian-states');

async function getMe(req, res, next) {
  try {
    const user = await userRepository.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Account not found.' });
    }
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function listAdminAppUsers(_req, res, next) {
  try {
    const [users, entitlements, products] = await Promise.all([
      userRepository.listAppUsers(),
      feePlanRepository.getActiveEntitlementsForAdmin(),
      questionBankRepository.getProductNames(),
    ]);
    const productNames = new Map(products.map((product) => [String(product.id), product.name]));
    const coursesByUser = new Map();
    entitlements.forEach((entitlement) => {
      const productCourses = (Array.isArray(entitlement.productIds) ? entitlement.productIds : [])
        .map((productId) => productNames.get(String(productId)))
        .filter(Boolean);
      const courses = productCourses.length
        ? productCourses
        : [entitlement.planName].filter(Boolean);
      const enrolledCourses = coursesByUser.get(entitlement.userId) || [];
      courses.forEach((course) => {
        if (!enrolledCourses.includes(course)) enrolledCourses.push(course);
      });
      coursesByUser.set(entitlement.userId, enrolledCourses);
    });
    return res.json({
      users: users.map((user) => ({
        ...user,
        enrolledCourses: coursesByUser.get(user.id) || [],
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  const { name, state, batchYear, email } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;
  const validEmail = email === undefined ||
    normalizedEmail === null ||
    normalizedEmail === '' ||
    (typeof normalizedEmail === 'string' &&
      normalizedEmail.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail));
  if (
    typeof name !== 'string' ||
    name.trim().length < 1 ||
    name.trim().length > 100 ||
    typeof state !== 'string' ||
    !indianStates.includes(state.trim()) ||
    !Number.isInteger(Number(batchYear)) ||
    Number(batchYear) < 2016 ||
    Number(batchYear) > new Date().getFullYear() ||
    !validEmail
  ) {
    return res.status(400).json({ message: 'Enter a valid name, state, batch year, and email.' });
  }

  try {
    const user = await userRepository.updateProfile(req.user.id, {
      name,
      state: state.trim(),
      batchYear: Number(batchYear),
      ...(email !== undefined ? { email: normalizedEmail || null } : {}),
    });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMe, listAdminAppUsers, updateProfile };

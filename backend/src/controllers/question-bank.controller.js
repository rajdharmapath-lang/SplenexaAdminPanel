const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const questionBankRepository = require('../db/question-bank.repository');
const adminAccountRepository = require('../db/admin-account.repository');
const adminSessionRepository = require('../db/admin-session.repository');
const { getJwtSecret } = require('../middleware/auth.middleware');
const { hashPassword, verifyPassword } = require('../services/admin-password');

function getSignupAccount(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Enter all required account details.' };
  }

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const professional = body.professional;
  const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (
    !firstName || firstName.length > 80 ||
    !lastName || lastName.length > 80 ||
    !['Student', 'Doctor'].includes(professional) ||
    !/^\+?[0-9\s().-]{7,20}$/.test(mobile) ||
    mobile.replace(/\D/g, '').length < 7 ||
    mobile.replace(/\D/g, '').length > 15 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 12 ||
    password.length > 128
  ) {
    return { error: 'Enter valid details. Password must be 12 to 128 characters.' };
  }

  return {
    account: { firstName, lastName, professional, mobile, email, password },
  };
}

function isAdminAuthTableMissing(error) {
  return error.code === '42P01' || error.code === 'PGRST205';
}

function sendAccountTableSetupError(res, message) {
  return res.status(503).json({
    message,
  });
}

async function signUpAdmin(req, res, next) {
  const result = getSignupAccount(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  try {
    const { password, ...account } = result.account;
    await adminAccountRepository.createAdminAccount({
      ...account,
      password_hash: await hashPassword(password),
    });
    return res.status(201).json({
      message: 'Account created. Sign in with your email and password.',
    });
  } catch (error) {
    if (isAdminAuthTableMissing(error)) {
      return sendAccountTableSetupError(
        res,
        'Signup is not set up yet. Apply the admin accounts migration in Supabase.',
      );
    }
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'An account with this email is already registered.',
      });
    }
    return next(error);
  }
}

async function loginAdmin(req, res, next) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 128) {
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }

  try {
    const account = await adminAccountRepository.getAdminAccountByEmail(email);
    if (!account || !(await verifyPassword(password, account.password_hash))) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const token = jwt.sign(
      { purpose: 'question_bank_admin', adminId: account.admin_id, jti },
      getJwtSecret(),
      { expiresIn: '8h' },
    );
    await adminSessionRepository.createAdminSession({
      jti,
      adminId: account.admin_id,
      expiresAt,
    });
    return res.json({ token });
  } catch (error) {
    if (isAdminAuthTableMissing(error)) {
      return sendAccountTableSetupError(
        res,
        'Admin login is not set up yet. Apply the admin account and session migrations in Supabase.',
      );
    }
    return next(error);
  }
}

async function logoutAdmin(req, res, next) {
  try {
    await adminSessionRepository.revokeAdminSession(req.adminSession.jti);
    return res.json({ message: 'Signed out.' });
  } catch (error) {
    return next(error);
  }
}

function isCatalog(catalog) {
  return catalog &&
    typeof catalog === 'object' &&
    !Array.isArray(catalog) &&
    Array.isArray(catalog.products) &&
    Array.isArray(catalog.subjects) &&
    Array.isArray(catalog.questions) &&
    catalog.products.length <= 5000 &&
    catalog.subjects.length <= 20000 &&
    catalog.questions.length <= 50000;
}

async function getPublicCatalog(_req, res, next) {
  try {
    const catalog = await questionBankRepository.getCatalog();
    const activeProducts = catalog.products.filter((product) => product?.isActive === true);
    const activeProductIds = new Set(activeProducts.map((product) => String(product.id)));
    return res.json({
      products: activeProducts,
      subjects: catalog.subjects.filter((subject) => activeProductIds.has(String(subject?.productId))),
      questions: catalog.questions.filter((question) =>
        activeProductIds.has(String(question?.productId)) &&
        String(question?.status || 'Active').toLowerCase() === 'active',
      ),
    });
  } catch (error) {
    return next(error);
  }
}

async function getAdminCatalog(_req, res, next) {
  try {
    return res.json(await questionBankRepository.getCatalog());
  } catch (error) {
    return next(error);
  }
}

async function saveAdminCatalog(req, res, next) {
  if (!isCatalog(req.body)) {
    return res.status(400).json({
      message: 'Question Bank data must contain product, subject, and question arrays within the supported limits.',
    });
  }

  try {
    const catalog = await questionBankRepository.saveCatalog({
      products: req.body.products,
      subjects: req.body.subjects,
      questions: req.body.questions,
    });
    return res.json(catalog);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signUpAdmin,
  loginAdmin,
  logoutAdmin,
  getPublicCatalog,
  getAdminCatalog,
  saveAdminCatalog,
};

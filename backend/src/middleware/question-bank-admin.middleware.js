const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./auth.middleware');
const adminSessionRepository = require('../db/admin-session.repository');

async function requireQuestionBankAdmin(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    return res.status(401).json({ message: 'Question Bank admin sign-in is required.' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (
      payload.purpose !== 'question_bank_admin' ||
      typeof payload.adminId !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      return res.status(401).json({ message: 'Invalid or expired Question Bank admin session.' });
    }

    const session = await adminSessionRepository.getAdminSessionById(payload.jti);
    if (
      !session ||
      session.admin_id !== payload.adminId ||
      session.revoked_at ||
      Date.parse(session.expires_at) <= Date.now()
    ) {
      return res.status(401).json({ message: 'Invalid or expired Question Bank admin session.' });
    }

    req.adminSession = session;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired Question Bank admin session.' });
    }
    return next(error);
  }
}

module.exports = { requireQuestionBankAdmin };

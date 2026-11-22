const express = require('express');
const { rateLimit } = require('express-rate-limit');
const questionBankController = require('../controllers/question-bank.controller');
const { requireQuestionBankAdmin } = require('../middleware/question-bank-admin.middleware');

const router = express.Router();
const adminRouter = express.Router();
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please wait and try again.' },
});
const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many signup attempts. Please wait and try again.' },
});

router.get('/', questionBankController.getPublicCatalog);

adminRouter.post('/login', loginRateLimit, questionBankController.loginAdmin);
adminRouter.post('/signup', signupRateLimit, questionBankController.signUpAdmin);
adminRouter.use(requireQuestionBankAdmin);
adminRouter.get('/session', questionBankController.getAdminSession);
adminRouter.post('/logout', questionBankController.logoutAdmin);
adminRouter.get('/', questionBankController.getAdminCatalog);
adminRouter.put('/', questionBankController.saveAdminCatalog);

router.use('/admin', adminRouter);

module.exports = router;

const express = require('express');
const feePlanController = require('../controllers/fee-plan.controller');
const { requireQuestionBankAdmin } = require('../middleware/question-bank-admin.middleware');

const router = express.Router();
const adminRouter = express.Router();

router.get('/', feePlanController.getPublicPlans);

adminRouter.use(requireQuestionBankAdmin);
adminRouter.get('/', feePlanController.getAdminPlans);
adminRouter.post('/', feePlanController.saveAdminPlan);
adminRouter.put('/:id', feePlanController.saveAdminPlan);
adminRouter.delete('/:id', feePlanController.deleteAdminPlan);
router.use('/admin', adminRouter);

module.exports = router;

const express = require('express');
const userController = require('../controllers/user.controller');
const { requireQuestionBankAdmin } = require('../middleware/question-bank-admin.middleware');

const router = express.Router();

router.get('/admin', requireQuestionBankAdmin, userController.listAdminAppUsers);

module.exports = router;

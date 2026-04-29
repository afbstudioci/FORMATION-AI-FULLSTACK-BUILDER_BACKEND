const express = require('express');
const router = express.Router();
const { getAllSubmissions, downloadPDF } = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');
const { verifyAdminPassword } = require('../middleware/adminMiddleware');

router.use(protect);
router.use(admin);
router.use(verifyAdminPassword);

router.get('/submissions', getAllSubmissions);
router.get('/submissions/:id/pdf', downloadPDF);

module.exports = router;

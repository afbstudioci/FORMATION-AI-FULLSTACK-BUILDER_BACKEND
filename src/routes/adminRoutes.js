const express = require('express');
const router = express.Router();
const { getAllSubmissions, downloadPDF, getAdminStats } = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');
const { verifyAdminPassword } = require('../middleware/adminMiddleware');

router.use(protect);
router.use(admin);

router.get('/stats', getAdminStats);
router.get('/submissions', getAllSubmissions);

// Actions plus sensibles nécessitant le mot de passe admin
router.use(verifyAdminPassword);
router.get('/submissions/:id/pdf', downloadPDF);
router.delete('/submissions/:id', deleteSubmission);

module.exports = router;

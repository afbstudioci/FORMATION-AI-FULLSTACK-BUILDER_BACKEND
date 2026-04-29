const express = require('express');
const router = express.Router();
const { submitExam, getMySubmissions } = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, submitExam);
router.get('/my', protect, getMySubmissions);

module.exports = router;

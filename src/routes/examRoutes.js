const express = require('express');
const router = express.Router();
const { createExam, getExams, getExamById } = require('../controllers/examController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, admin, createExam)
  .get(protect, getExams);

router.route('/:id')
  .get(protect, getExamById);

module.exports = router;

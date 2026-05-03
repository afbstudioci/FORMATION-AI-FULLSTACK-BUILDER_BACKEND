const express = require('express');
const router = express.Router();
const { createExam, getExams, getExamById, deleteExam, generateExamFromAI, togglePublishExam } = require('../controllers/examController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, admin, createExam)
  .get(protect, getExams);

router.post('/generate', protect, admin, generateExamFromAI);

router.route('/:id')
  .get(protect, getExamById)
  .delete(protect, admin, deleteExam);

router.put('/:id/publish', protect, admin, togglePublishExam);

module.exports = router;

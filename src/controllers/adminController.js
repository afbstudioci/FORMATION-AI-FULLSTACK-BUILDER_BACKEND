const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Exam = require('../models/Exam');
const { generateStudentCopyPDF } = require('../utils/pdfGenerator');

// Recuperer les statistiques globales - GET /api/admin/stats
const getAdminStats = asyncHandler(async (req, res) => {
  const totalStudents = await User.countDocuments({ role: 'student' });
  const totalExams = await Exam.countDocuments({});
  const totalSubmissions = await Submission.countDocuments({});
  
  res.json({
    totalStudents,
    totalExams,
    totalSubmissions
  });
});

// Recuperer toutes les soumissions - GET /api/admin/submissions
const getAllSubmissions = asyncHandler(async (req, res) => {
  const submissions = await Submission.find({})
    .populate('user', 'fullname matricule')
    .populate('exam', 'title questions startTime endTime');
  res.json(submissions);
});

// Telecharger une copie PDF - GET /api/admin/submissions/:id/pdf
const downloadPDF = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('user', 'fullname matricule')
    .populate('exam', 'title questions');

  if (!submission) {
    res.status(404);
    throw new Error('Soumission non trouvee');
  }

  const pdfBuffer = await generateStudentCopyPDF(submission);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=copie_${submission.user.matricule}.pdf`,
    'Content-Length': pdfBuffer.length,
  });

  res.send(pdfBuffer);
});

// Supprimer une soumission - DELETE /api/admin/submissions/:id
const deleteSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) {
    res.status(404);
    throw new Error('Copie non trouvée');
  }
  await submission.deleteOne();
  res.json({ message: 'Copie supprimée avec succès' });
});

module.exports = { getAllSubmissions, downloadPDF, getAdminStats, deleteSubmission };

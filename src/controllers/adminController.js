const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const { generateStudentCopyPDF } = require('../utils/pdfGenerator');

// Recuperer toutes les soumissions - GET /api/admin/submissions
const getAllSubmissions = asyncHandler(async (req, res) => {
  const submissions = await Submission.find({})
    .populate('user', 'fullname matricule')
    .populate('exam', 'title questions');
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

module.exports = { getAllSubmissions, downloadPDF };

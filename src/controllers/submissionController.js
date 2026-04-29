const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const { calculateScore } = require('../utils/gradingEngine');

// Soumettre un examen - POST /api/submissions
const submitExam = asyncHandler(async (req, res) => {
  const { examId, answers, tabSwitchesCount } = req.body;
  const userId = req.user._id;

  const exam = await Exam.findById(examId);
  if (!exam) {
    res.status(404);
    throw new Error('Examen non trouve');
  }

  // Verification du temps STRICTEMENT sur le serveur
  const now = new Date();
  if (now < exam.startTime || now > exam.endTime) {
    res.status(403);
    throw new Error("La periode de soumission est fermee ou n'a pas encore debute");
  }

  // Verification si deja soumis
  const alreadySubmitted = await Submission.findOne({ user: userId, exam: examId });
  if (alreadySubmitted) {
    res.status(400);
    throw new Error("Vous avez deja soumis cet examen");
  }

  // Calcul automatique de la note
  const score = calculateScore(exam.questions, answers, tabSwitchesCount);

  const submission = await Submission.create({
    user: userId,
    exam: examId,
    answers,
    tabSwitchesCount,
    score,
    status: req.body.status || 'COMPLETED',
    submittedAt: now
  });

  // Notification temps reel aux admins
  const io = req.app.get('socketio');
  const submissionWithData = await Submission.findById(submission._id).populate('user', 'fullname matricule').populate('exam', 'title');
  io.emit('new_submission', submissionWithData);

  res.status(201).json({
    message: "Examen soumis avec succes",
    score: submission.score,
    status: submission.status
  });
});

// Recuperer ses propres soumissions - GET /api/submissions/my
const getMySubmissions = asyncHandler(async (req, res) => {
  const submissions = await Submission.find({ user: req.user._id }).populate('exam', 'title startTime endTime');
  res.json(submissions);
});

module.exports = { submitExam, getMySubmissions };

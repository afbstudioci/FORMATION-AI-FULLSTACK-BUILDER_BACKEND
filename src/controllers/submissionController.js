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
    throw new Error('Examen non trouvé');
  }

  // Vérification du temps STRICTEMENT sur le serveur
  const now = new Date();
  if (now < exam.startTime || now > exam.endTime) {
    res.status(403);
    throw new Error("La période de soumission est fermée ou n'a pas encore débuté");
  }

  // Vérification si déjà soumis
  const alreadySubmitted = await Submission.findOne({ user: userId, exam: examId });
  if (alreadySubmitted) {
    res.status(400);
    throw new Error("Vous avez déjà soumis cet examen");
  }

  // Calcul automatique de la note
  const score = calculateScore(exam.questions, answers, tabSwitchesCount, exam.pointsPerQuestion);

  const submission = await Submission.create({
    user: userId,
    exam: examId,
    answers,
    tabSwitchesCount,
    score,
    pointsPerQuestion: exam.pointsPerQuestion,
    status: req.body.status || 'COMPLETED',
    submittedAt: now
  });

  // Notification temps réel ciblée pour les administrateurs
  const io = req.app.get('socketio');
  if (io) {
    const submissionWithData = await Submission.findById(submission._id)
      .populate('user', 'fullname matricule')
      .populate('exam', 'title');

    io.to('admin_room').emit('newSubmission', submissionWithData);
  }

  res.status(201).json({
    message: "Examen soumis avec succès",
    score: submission.score,
    status: submission.status
  });
});

// Récupérer ses propres soumissions - GET /api/submissions/my
const getMySubmissions = asyncHandler(async (req, res) => {
  const submissions = await Submission.find({ user: req.user._id }).populate('exam', 'title startTime endTime');
  res.json(submissions);
});

module.exports = { submitExam, getMySubmissions };
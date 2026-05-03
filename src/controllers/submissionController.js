const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const { calculateScore } = require('../utils/gradingEngine');

// Démarrer un examen (Tentative unique) - POST /api/submissions/start
const startExamSession = asyncHandler(async (req, res) => {
  const { examId } = req.body;
  const userId = req.user._id;

  const exam = await Exam.findById(examId);
  if (!exam) {
    res.status(404);
    throw new Error('Examen non trouvé');
  }

  const now = new Date();
  const gracePeriod = 30 * 1000;
  if (now.getTime() < (exam.startTime.getTime() - gracePeriod) || now > exam.endTime) {
    res.status(403);
    throw new Error("La période n'est pas valide");
  }

  const alreadySubmitted = await Submission.findOne({ user: userId, exam: examId });
  if (alreadySubmitted) {
    res.status(400);
    throw new Error("Vous avez déjà commencé ou soumis cet examen");
  }

  const submission = await Submission.create({
    user: userId,
    exam: examId,
    answers: [],
    tabSwitchesCount: 0,
    score: 0,
    pointsPerQuestion: exam.pointsPerQuestion,
    status: 'IN_PROGRESS',
    submittedAt: now
  });

  res.status(201).json(submission);
});

// Soumettre un examen - POST /api/submissions
const submitExam = asyncHandler(async (req, res) => {
  const { examId, answers, tabSwitchesCount } = req.body;
  const userId = req.user._id;

  const exam = await Exam.findById(examId);
  if (!exam) {
    res.status(404);
    throw new Error('Examen non trouvé');
  }

  let submission = await Submission.findOne({ user: userId, exam: examId });
  
  if (submission && submission.status === 'COMPLETED') {
    res.status(400);
    throw new Error("Vous avez déjà soumis cet examen");
  }

  const score = calculateScore(exam.questions, answers, tabSwitchesCount, exam.pointsPerQuestion);
  const now = new Date();

  if (submission) {
    submission.answers = answers;
    submission.tabSwitchesCount = tabSwitchesCount;
    submission.score = score;
    submission.status = req.body.status || 'COMPLETED';
    submission.submittedAt = now;
    await submission.save();
  } else {
    // Fallback de sécurité
    submission = await Submission.create({
      user: userId,
      exam: examId,
      answers,
      tabSwitchesCount,
      score,
      pointsPerQuestion: exam.pointsPerQuestion,
      status: req.body.status || 'COMPLETED',
      submittedAt: now
    });
  }

  // Notification temps réel ciblée pour les administrateurs
  const io = req.app.get('socketio');
  if (io) {
    const submissionWithData = await Submission.findById(submission._id)
      .populate('user', 'fullname matricule')
      .populate('exam', 'title');

    io.to('admin_room').emit('newSubmission', submissionWithData);
    // On notifie aussi globalement pour que l'étudiant voit son statut changer en temps réel
    io.emit('submissionUpdate', { 
      examId: submission.exam, 
      userId: submission.user,
      hasSubmitted: true 
    });
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

module.exports = { startExamSession, submitExam, getMySubmissions };
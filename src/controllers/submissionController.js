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

  const { score, answers: gradedAnswers, correctAnswersCount, questionsCount } = await calculateScore(exam.questions, answers, tabSwitchesCount, exam.pointsPerQuestion, exam.type);
  const now = new Date();

  const targetStatus = req.body.status || 'COMPLETED';
  const isCompleting = targetStatus === 'COMPLETED' && (!submission || submission.status !== 'COMPLETED');

  if (submission) {
    submission.answers = gradedAnswers;
    submission.tabSwitchesCount = tabSwitchesCount;
    submission.score = score;
    submission.status = targetStatus;
    submission.correctAnswersCount = correctAnswersCount;
    submission.questionsCount = questionsCount;
    submission.submittedAt = now;
    await submission.save();
  } else {
    // Fallback de sécurité
    submission = await Submission.create({
      user: userId,
      exam: examId,
      answers: gradedAnswers,
      tabSwitchesCount,
      score,
      pointsPerQuestion: exam.pointsPerQuestion,
      status: targetStatus,
      correctAnswersCount,
      questionsCount,
      submittedAt: now
    });
  }

  // Mise à jour des statistiques utilisateur permanentes si l'examen est terminé
  if (isCompleting) {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (user) {
      if (!user.stats) {
        user.stats = {
          averageScore: 0,
          totalExams: 0,
          precision: 0,
          resilience: 100,
          totalQuestions: 0,
          totalCorrectAnswers: 0,
          totalScore: 0,
          totalTabSwitchesCount: 0
        };
      }

      user.stats.totalExams += 1;
      user.stats.totalScore += score;
      user.stats.totalCorrectAnswers += correctAnswersCount;
      user.stats.totalQuestions += questionsCount;
      user.stats.totalTabSwitchesCount += tabSwitchesCount;

      user.stats.averageScore = Number((user.stats.totalScore / user.stats.totalExams).toFixed(2));
      user.stats.precision = user.stats.totalQuestions > 0
        ? Number(((user.stats.totalCorrectAnswers / user.stats.totalQuestions) * 100).toFixed(1))
        : 0;
      user.stats.resilience = Math.max(0, 100 - (user.stats.totalTabSwitchesCount * 10 / user.stats.totalExams));

      await user.save();
      console.log(`[STATS] Stats mises à jour pour l'étudiant ${user.fullname}. Total examens : ${user.stats.totalExams}, Moyenne : ${user.stats.averageScore}%`);
    }
  }

  // Notification temps réel ciblée pour les administrateurs
  const io = req.app.get('socketio');
  if (io) {
    const submissionWithData = await Submission.findById(submission._id)
      .populate('user', 'fullname matricule')
      .populate('exam', 'title questions');

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
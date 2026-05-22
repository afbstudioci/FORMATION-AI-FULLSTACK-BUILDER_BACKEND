const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Exam = require('../models/Exam');
const { generateStudentCopyPDF } = require('../utils/pdfGenerator');

// Récupérer les statistiques globales - GET /api/admin/stats
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

// Récupérer toutes les soumissions - GET /api/admin/submissions
const getAllSubmissions = asyncHandler(async (req, res) => {
  const submissions = await Submission.find({})
    .populate('user', 'fullname matricule')
    .populate('exam', 'title questions startTime endTime');
  res.json(submissions);
});

// Télécharger une copie PDF - GET /api/admin/submissions/:id/pdf
const downloadPDF = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('user', 'fullname matricule')
    .populate('exam', 'title questions');

  if (!submission) {
    res.status(404);
    throw new Error('Soumission non trouvée');
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

// Récupérer tous les utilisateurs - GET /api/admin/users
const getUsers = asyncHandler(async (req, res) => {
  // On exclut strictement le compte MASTER-ROOT de la liste
  const users = await User.find({ 
    matricule: { $ne: 'MASTER_ROOT' },
    _id: { $ne: '000000000000000000000000' }
  }).select('-password');
  res.json(users);
});

// Mettre à jour le rôle d'un utilisateur - PATCH /api/admin/users/:id/role
const updateUserRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  // SÉCURITÉ ABSOLUE : Personne ne peut toucher au compte MASTER
  if (user.matricule === 'MASTER_ROOT' || user._id.toString() === '000000000000000000000000') {
    res.status(403);
    throw new Error('Action interdite sur le compte Maître Suprême');
  }

  // Empêcher l'admin de se rétrograder lui-même
  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('Vous ne pouvez pas modifier votre propre rôle');
  }

  user.role = req.body.role || (user.role === 'admin' ? 'student' : 'admin');
  await user.save();

  // Notification Temps Réel à l'utilisateur concerné
  const io = req.app.get('socketio');
  io.emit('role_updated', { userId: user._id, newRole: user.role });

  res.json({ message: `Rôle mis à jour : ${user.role}`, user });
});

// Recorriger manuellement une copie - POST /api/admin/submissions/:id/regrade
const regradeSubmission = asyncHandler(async (req, res) => {
  const { answers } = req.body; // Array of { questionId, score, feedback }
  
  if (!answers || !Array.isArray(answers)) {
    res.status(400);
    throw new Error("Le format des réponses de recorrection est invalide");
  }

  const submission = await Submission.findById(req.params.id)
    .populate('user', 'fullname matricule')
    .populate('exam', 'title questions pointsPerQuestion');

  if (!submission) {
    res.status(404);
    throw new Error('Copie non trouvée');
  }

  const oldScore = submission.score || 0;
  const oldCorrectAnswers = submission.correctAnswersCount || 0;

  // Mettre à jour chaque réponse soumise avec les scores/feedbacks de recorrection
  answers.forEach((regrade) => {
    const originalAnswer = submission.answers.find(a => a.questionId.toString() === regrade.questionId.toString());
    if (originalAnswer) {
      if (regrade.score !== undefined) {
        originalAnswer.score = Number(regrade.score);
      }
      if (regrade.feedback !== undefined) {
        originalAnswer.feedback = regrade.feedback;
      }
    }
  });

  // Calculer la note globale : somme des scores individuels - pénalité d'onglets
  const sumScores = submission.answers.reduce((acc, ans) => acc + (ans.score || 0), 0);
  const penalty = (submission.tabSwitchesCount || 0) * 1;
  
  // RÈGLE D'OR : La note globale ne peut pas être négative
  submission.score = Math.max(0, sumScores - penalty);

  // Recalculer le nombre de réponses correctes après recorrection
  let newCorrectAnswersCount = 0;
  const p = submission.exam.pointsPerQuestion || 1;
  submission.answers.forEach(ans => {
    const q = submission.exam.questions.find(quest => quest._id.toString() === ans.questionId.toString());
    if (q) {
      const isQCM = !q.type || q.type === 'qcm';
      if (isQCM) {
        if (ans.selectedOption === q.correctAnswer) {
          newCorrectAnswersCount++;
        }
      } else {
        if (ans.score >= p / 2) {
          newCorrectAnswersCount++;
        }
      }
    }
  });

  submission.correctAnswersCount = newCorrectAnswersCount;
  
  await submission.save();

  // Ajuster les statistiques permanentes de l'étudiant
  const student = await User.findById(submission.user._id);
  if (student && student.stats) {
    const scoreDiff = submission.score - oldScore;
    const correctAnswersDiff = newCorrectAnswersCount - oldCorrectAnswers;

    student.stats.totalScore += scoreDiff;
    student.stats.totalCorrectAnswers += correctAnswersDiff;

    student.stats.averageScore = Number((student.stats.totalScore / student.stats.totalExams).toFixed(2));
    student.stats.precision = student.stats.totalQuestions > 0
      ? Number(((student.stats.totalCorrectAnswers / student.stats.totalQuestions) * 100).toFixed(1))
      : 0;

    await student.save();
    console.log(`[STATS] Stats adaptées après recorrection pour l'étudiant ${student.fullname}. Score diff: ${scoreDiff}, Correct diff: ${correctAnswersDiff}`);
  }

  // Notification temps réel ciblée
  const io = req.app.get('socketio');
  if (io) {
    // Recharger la soumission mise à jour avec toutes les infos peuplées
    const updatedSub = await Submission.findById(submission._id)
      .populate('user', 'fullname matricule')
      .populate('exam', 'title questions pointsPerQuestion');

    // Émettre à la room admin et globale pour la mise à jour immédiate
    io.to('admin_room').emit('newSubmission', updatedSub);
    io.emit('submissionUpdate', { 
      examId: submission.exam._id, 
      userId: submission.user._id,
      hasSubmitted: true,
      score: submission.score
    });
  }

  res.json({
    message: "Copie recorrigée et note actualisée avec succès",
    submission
  });
});

module.exports = { getAllSubmissions, downloadPDF, getAdminStats, deleteSubmission, getUsers, updateUserRole, regradeSubmission };

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

module.exports = { getAllSubmissions, downloadPDF, getAdminStats, deleteSubmission, getUsers, updateUserRole };

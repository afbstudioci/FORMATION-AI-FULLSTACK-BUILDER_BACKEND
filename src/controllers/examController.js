const asyncHandler = require('express-async-handler');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');

// Creer un examen - POST /api/exams
const createExam = asyncHandler(async (req, res) => {
  const { title, description, startTime, endTime, questions, pointsPerQuestion } = req.body;

  if (new Date(startTime) >= new Date(endTime)) {
    res.status(400);
    throw new Error("L'heure de fin doit être supérieure à l'heure de début");
  }

  const exam = await Exam.create({
    title,
    description,
    startTime,
    endTime,
    questions,
    pointsPerQuestion: pointsPerQuestion || 1,
    creator: req.user._id
  });

  res.status(201).json(exam);

  // Notification temps réel aux étudiants
  const io = req.app.get('socketio');
  if (io) io.emit('new_exam', exam);
});

// Recuperer tous les examens - GET /api/exams
const getExams = asyncHandler(async (req, res) => {
  const exams = await Exam.find({}).select('-questions.correctAnswer').lean();
  
  // Si c'est un étudiant, on marque ceux qu'il a déjà passés
  if (req.user && req.user.role === 'student') {
    const userSubmissions = await Submission.find({ user: req.user._id }).select('exam');
    const submittedExamIds = new Set(userSubmissions.map(s => s.exam.toString()));
    
    exams.forEach(exam => {
      exam.hasSubmitted = submittedExamIds.has(exam._id.toString());
    });
  } else {
    // Pour les admins, par défaut false ou non défini
    exams.forEach(exam => {
      exam.hasSubmitted = false;
    });
  }
  
  res.json(exams);
});

// Recuperer un examen specifique - GET /api/exams/:id
const getExamById = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    res.status(404);
    throw new Error('Examen non trouvé');
  }

  // Sécurité : Vérifier si l'étudiant a déjà composé
  if (req.user.role === 'student') {
    const existingSubmission = await Submission.findOne({ 
      user: req.user._id, 
      exam: req.params.id 
    });

    if (existingSubmission) {
      res.status(403);
      throw new Error("Vous avez déjà passé cette composition. Tentative unique verrouillée.");
    }
  }

  const now = new Date();
  if (now < exam.startTime && req.user.role !== 'admin') {
    res.status(403);
    throw new Error("Cet examen n'est pas encore accessible");
  }

  const examData = exam.toObject();
  if (req.user.role !== 'admin') {
    examData.questions.forEach(q => delete q.correctAnswer);
  }

  res.json(examData);
});

// Supprimer un examen - DELETE /api/exams/:id
const deleteExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    res.status(404);
    throw new Error('Examen non trouvé');
  }
  await exam.deleteOne();
  res.json({ message: 'Examen supprimé' });
});

const { generateQCM } = require('../utils/aiService');

// Generer un examen via IA - POST /api/exams/generate
const generateExamFromAI = asyncHandler(async (req, res) => {
  const { lessonContent, questionCount, optionsCount } = req.body;

  try {
    const aiResult = await generateQCM(lessonContent, questionCount, optionsCount);
    res.json(aiResult);
  } catch (err) {
    console.error("Erreur Gemini:", err);
    res.status(500);
    throw new Error("L'IA Gemini a rencontré un problème : " + err.message);
  }
});

module.exports = { createExam, getExams, getExamById, deleteExam, generateExamFromAI };

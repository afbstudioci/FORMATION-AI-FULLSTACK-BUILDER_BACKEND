const asyncHandler = require('express-async-handler');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const mongoose = require('mongoose');

// Créer un examen - POST /api/exams
const createExam = asyncHandler(async (req, res) => {
  const { title, description, startTime, endTime, questions, pointsPerQuestion, isPublished } = req.body;

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
    isPublished: isPublished || false,
    pointsPerQuestion: pointsPerQuestion || 1,
    creator: req.user._id
  });

  res.status(201).json(exam);

  const io = req.app.get('socketio');
  if (io) {
    io.emit('examCreated', exam);
  }
});

// Publier/Dépublier un examen - PUT /api/exams/:id/publish
const togglePublishExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  
  if (!exam) {
    res.status(404);
    throw new Error('Examen non trouvé');
  }

  exam.isPublished = !exam.isPublished;
  await exam.save();

  const io = req.app.get('socketio');
  if (io) {
    io.emit('examPublished', { examId: exam._id, isPublished: exam.isPublished });
  }

  res.json({ 
    message: exam.isPublished ? 'Examen publié avec succès' : 'Examen dépublié',
    isPublished: exam.isPublished 
  });
});

// Récupérer tous les examens - GET /api/exams
const getExams = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'student' ? { $or: [{ isPublished: true }, { isPublished: { $exists: false } }] } : {};
  const exams = await Exam.find(filter).select('-questions.correctAnswer').sort({ createdAt: -1 }).lean();

  const now = new Date();
  
  if (req.user && req.user.role === 'student') {
    const userSubmissions = await Submission.find({ user: req.user._id }).select('exam').lean();
    
    console.log(`[DEBUG] Dashboard for ${req.user.fullname}: ${userSubmissions.length} submissions found.`);
    
    const submittedExamIds = new Set(userSubmissions.map(s => s.exam.toString()));
    
    exams.forEach(exam => {
      exam.hasSubmitted = submittedExamIds.has(exam._id.toString());
      if (now < exam.startTime) {
        exam.status = 'En attente';
      } else if (now > exam.endTime) {
        exam.status = 'Terminé';
      } else {
        exam.status = 'Disponible';
      }
      if (exam.hasSubmitted) {
        console.log(`[DEBUG] Exam marked as submitted: ${exam.title}`);
      }
    });
  } else {
    exams.forEach(exam => {
      exam.hasSubmitted = false;
    });
  }

  res.json(exams);
});

// Récupérer un examen spécifique - GET /api/exams/:id
const getExamById = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    res.status(404);
    throw new Error('Examen non trouvé');
  }

  if (req.user.role === 'student' && exam.isPublished === false) {
    res.status(403);
    throw new Error("Cet examen n'est pas encore publié");
  }

  // Vérification uniquement pour la soumission - on laisse l'accès en lecture même si déjà soumis
  const now = new Date();
  const gracePeriod = 5 * 60 * 1000; // 5 minutes

  if (req.user.role !== 'admin') {
    if (now.getTime() < (new Date(exam.startTime).getTime() - gracePeriod)) {
      res.status(403);
      throw new Error("Cet examen n'est pas encore accessible");
    }

    if (now > exam.endTime) {
      res.status(403);
      throw new Error("Cet examen est terminé");
    }
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

  // Notification temps réel globale
  const io = req.app.get('socketio');
  if (io) {
    io.emit('examDeleted', req.params.id);
  }

  res.json({ message: 'Examen supprimé' });
});

const { generateQCM } = require('../utils/aiService');

// Générer un examen via IA - POST /api/exams/generate
const generateExamFromAI = asyncHandler(async (req, res) => {
  const { lessonContent, questionCount, optionsCount } = req.body;
  console.log("--- IA GENERATION START ---");
  console.log("Content length:", lessonContent?.length);

  try {
    const aiResult = await generateQCM(lessonContent, questionCount, optionsCount);
    console.log("--- IA GENERATION SUCCESS ---");
    res.json(aiResult);
  } catch (err) {
    console.error("--- IA GENERATION ERROR ---");
    console.error(err);
    res.status(500);
    throw new Error("L'IA Gemini a rencontré un problème : " + err.message);
  }
});

module.exports = { createExam, getExams, getExamById, deleteExam, generateExamFromAI, togglePublishExam };
const asyncHandler = require('express-async-handler');
const Exam = require('../models/Exam');

// Creer un examen - POST /api/exams
const createExam = asyncHandler(async (req, res) => {
  const { title, description, startTime, endTime, questions } = req.body;

  if (new Date(startTime) >= new Date(endTime)) {
    res.status(400);
    throw new Error("L'heure de fin doit etre superieure a l'heure de debut");
  }

  const exam = await Exam.create({
    title,
    description,
    startTime,
    endTime,
    questions,
    creator: req.user._id
  });

  res.status(201).json(exam);

  // Notification temps reel aux etudiants
  const io = req.app.get('socketio');
  io.emit('new_exam', exam);
});

// Recuperer tous les examens - GET /api/exams
const getExams = asyncHandler(async (req, res) => {
  // On ne renvoie pas les reponses aux etudiants
  const exams = await Exam.find({}).select('-questions.correctAnswer');
  res.json(exams);
});

// Recuperer un examen specifique - GET /api/exams/:id
const getExamById = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    res.status(404);
    throw new Error('Examen non trouve');
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
    throw new Error('Examen non trouve');
  }
  await exam.deleteOne();
  res.json({ message: 'Examen supprime' });
});

// Generer un examen via IA - POST /api/exams/generate
const generateExamFromAI = asyncHandler(async (req, res) => {
  const { lessonContent, questionCount, optionsCount } = req.body;

  if (!lessonContent) {
    res.status(400);
    throw new Error("Contenu de la lecon manquant");
  }

  // Simulation d'IA (en attendant une cle API réelle comme Gemini)
  // On decoupe le texte et on genere des questions basées sur les phrases
  const sentences = lessonContent.split(/[.!?]/).filter(s => s.trim().length > 20);
  const questions = sentences.slice(0, questionCount).map((sentence, idx) => {
    const words = sentence.trim().split(' ');
    const subject = words.slice(0, 3).join(' ');
    
    const options = Array.from({ length: optionsCount }, (_, i) => {
      if (i === 0) return sentence.trim(); // La bonne reponse est la phrase originale
      return `Option alternative ${i} pour : ${subject}...`;
    });

    // Melanger les options
    const shuffledOptions = [...options].sort(() => Math.random() - 0.5);

    return {
      text: `Selon le texte, que signifie : "${subject}..." ?`,
      options: shuffledOptions,
      correctAnswer: sentence.trim()
    };
  });

  res.json({
    title: `Examen auto-généré : ${lessonContent.substring(0, 20)}...`,
    description: "Cet examen a ete genere automatiquement par le systeme intelligent.",
    questions
  });
});

module.exports = { createExam, getExams, getExamById, deleteExam, generateExamFromAI };

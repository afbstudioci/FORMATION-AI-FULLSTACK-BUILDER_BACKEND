const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Submission = require('../models/Submission');
const { generateQCM } = require('../utils/aiService');

// Récupérer le profil utilisateur avec stats - GET /api/users/profile
const getUserProfile = asyncHandler(async (req, res) => {
  let user = await User.findById(req.user._id).select('-password');
  
  // Si c'est le Master Admin et qu'il n'est pas encore en BDD, on renvoie les infos virtuelles
  if (!user && req.user._id === "000000000000000000000000") {
    user = {
      _id: "000000000000000000000000",
      fullname: "Master Admin",
      matricule: "MASTER-ROOT",
      role: "admin",
      profilePic: "https://ui-avatars.com/api/?name=Admin+AFB&background=0984e3&color=fff&size=128",
      bio: "Compte Administrateur Principal AFB EXAM.",
      themePreference: "dark",
      createdAt: new Date("2024-01-01")
    };
  }
  
  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouve');
  }

  // Calcul des stats pour les etudiants
  let stats = null;
  if (user.role === 'student') {
    // Migration à la volée transparente pour les utilisateurs existants
    if (!user.stats || user.stats.totalExams === 0) {
      const submissions = await Submission.find({ user: user._id }).populate('exam');
      if (submissions.length > 0) {
        let totalScore = 0;
        let totalCorrectAnswers = 0;
        let totalQuestions = 0;
        let totalTabSwitchesCount = 0;
        let totalExams = 0;

        for (const sub of submissions) {
          if (sub.status === 'COMPLETED') {
            totalExams++;
            totalScore += sub.score || 0;
            totalTabSwitchesCount += sub.tabSwitchesCount || 0;

            // Calculer correctAnswersCount et questionsCount s'ils ne sont pas stockés sur la soumission
            let correctAnswersCount = sub.correctAnswersCount || 0;
            let questionsCount = sub.questionsCount || (sub.exam?.questions?.length || 0);

            if (correctAnswersCount === 0 && sub.exam) {
              const p = sub.pointsPerQuestion || 1;
              sub.answers.forEach(ans => {
                const q = sub.exam.questions.find(quest => quest._id.toString() === ans.questionId.toString());
                if (q) {
                  if (q.type === 'qcm' || !q.type) {
                    if (ans.selectedOption === q.correctAnswer) correctAnswersCount++;
                  } else {
                    if (ans.score >= p / 2) correctAnswersCount++;
                  }
                }
              });
              // Sauvegarder sur la soumission
              sub.correctAnswersCount = correctAnswersCount;
              sub.questionsCount = questionsCount;
              await sub.save();
            }

            totalCorrectAnswers += correctAnswersCount;
            totalQuestions += questionsCount;
          }
        }

        if (totalExams > 0) {
          const averageScore = Number((totalScore / totalExams).toFixed(2));
          const precision = totalQuestions > 0 ? Number(((totalCorrectAnswers / totalQuestions) * 100).toFixed(1)) : 0;
          const resilience = Math.max(0, 100 - (totalTabSwitchesCount * 10 / totalExams));

          const updatedStats = {
            averageScore,
            totalExams,
            precision,
            resilience,
            totalQuestions,
            totalCorrectAnswers,
            totalScore,
            totalTabSwitchesCount
          };

          // Recharger le document mis à jour de User
          user = await User.findByIdAndUpdate(user._id, { stats: updatedStats }, { new: true }).select('-password');
        }
      }
    }

    // Si l'utilisateur n'a toujours pas de stats (aucun examen passé), on renvoie les valeurs par défaut
    const currentStats = user.stats || {
      averageScore: 0,
      totalExams: 0,
      precision: 0,
      resilience: 100
    };

    const averageScore = currentStats.averageScore || 0;
    const totalExams = currentStats.totalExams || 0;
    const precision = currentStats.precision || 0;
    const resilience = currentStats.resilience !== undefined ? currentStats.resilience : 100;

    stats = {
      averageScore,
      totalExams,
      precision,
      resilience,
      radar: [
        { subject: 'Logique', A: precision, fullMark: 100 },
        { subject: 'Vitesse', A: Math.min(100, totalExams * 20), fullMark: 100 },
        { subject: 'Precision', A: precision, fullMark: 100 },
        { subject: 'Resilience', A: resilience, fullMark: 100 },
        { subject: 'Rigueur', A: Math.max(0, 100 - (totalExams * 2)), fullMark: 100 },
      ]
    };
  }

  res.json({ user, stats });
});

// Mettre a jour le profil - PUT /api/users/profile
const updateUserProfile = asyncHandler(async (req, res) => {
  let user = await User.findById(req.user._id);

  // Si c'est le Master Admin et qu'il n'existe pas en BDD, on l'initialise
  if (!user && req.user._id === "000000000000000000000000") {
    user = new User({
      _id: "000000000000000000000000",
      fullname: "Master Admin",
      matricule: "MASTER-ROOT",
      password: process.env.PASSWORD_ADMIN,
      role: "admin"
    });
  }

  if (user) {
    user.fullname = req.body.fullname || user.fullname;
    user.bio = req.body.bio || user.bio;
    user.themePreference = req.body.themePreference || user.themePreference;
    
    if (req.file) {
      user.profilePic = req.file.path; // URL Cloudinary
    }

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      fullname: updatedUser.fullname,
      matricule: updatedUser.matricule,
      role: updatedUser.role,
      profilePic: updatedUser.profilePic,
      bio: updatedUser.bio,
      themePreference: updatedUser.themePreference
    });
  } else {
    res.status(404);
    throw new Error('Utilisateur non trouve');
  }
});

module.exports = { getUserProfile, updateUserProfile };

const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Submission = require('../models/Submission');
const { generateQCM } = require('../utils/aiService');

// Recuperer le profil utilisateur avec stats - GET /api/users/profile
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
    const submissions = await Submission.find({ user: user._id }).populate('exam');
    
    const totalExams = submissions.length;
    const totalScore = submissions.reduce((acc, curr) => acc + (curr.score || 0), 0);
    const totalCorrectAnswers = submissions.reduce((acc, curr) => acc + (curr.correctAnswers || 0), 0);
    const totalQuestions = submissions.reduce((acc, curr) => acc + (curr.exam?.questions?.length || 0), 0);
    
    const averageScore = totalExams > 0 ? (totalScore / totalExams).toFixed(2) : 0;
    const precision = totalQuestions > 0 ? ((totalCorrectAnswers / totalQuestions) * 100).toFixed(1) : 0;
    
    // Calcul pour le Radar de competences (Logique, Vitesse, Precision, Resilience, Rigueur)
    const resilience = submissions.length > 0 
      ? Math.max(0, 100 - (submissions.reduce((acc, curr) => acc + curr.tabSwitchesCount, 0) * 10)) 
      : 100;

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
        { subject: 'Rigueur', A: Math.max(0, 100 - (submissions.length * 2)), fullMark: 100 },
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

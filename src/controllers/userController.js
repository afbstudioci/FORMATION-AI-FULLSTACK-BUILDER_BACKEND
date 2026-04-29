const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Submission = require('../models/Submission');

// Recuperer le profil utilisateur avec stats - GET /api/users/profile
const getUserProfile = asyncHandler(async (req, res) => {
  // Gestion du Master Admin virtuel (pas en BDD)
  if (req.user && req.user._id === "000000000000000000000000") {
    return res.json({
      user: {
        _id: "000000000000000000000000",
        fullname: "Administrateur Principal",
        matricule: "MASTER-ROOT",
        role: "admin",
        profilePic: "",
        bio: "Compte de securite maitre du système AFB EXAM.",
        themePreference: "dark"
      },
      stats: null
    });
  }

  const user = await User.findById(req.user._id).select('-password');
  
  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouve');
  }

  // Calcul des stats pour les etudiants
  let stats = null;
  if (user.role === 'student') {
    const submissions = await Submission.find({ user: user._id }).populate('exam');
    
    const totalExams = submissions.length;
    const totalScore = submissions.reduce((acc, curr) => acc + curr.score, 0);
    const totalQuestions = submissions.reduce((acc, curr) => acc + (curr.exam?.questions?.length || 0), 0);
    
    const averageScore = totalExams > 0 ? (totalScore / totalExams).toFixed(2) : 0;
    const precision = totalQuestions > 0 ? ((totalScore / totalQuestions) * 100).toFixed(1) : 0;
    
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
  // Le Master Admin ne peut pas etre modifie en BDD car il n'y existe pas
  if (req.user && req.user._id === "000000000000000000000000") {
    res.status(403);
    throw new Error("Le compte Administrateur Principal est protege et ne peut pas etre modifie.");
  }

  const user = await User.findById(req.user._id);

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

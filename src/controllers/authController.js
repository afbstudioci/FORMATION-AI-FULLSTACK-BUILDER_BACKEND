//src/controllers/authController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateTokens = (id) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '365d' });
  return { accessToken, refreshToken };
};

// Inscription - POST /api/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { fullname, password } = req.body;

  // Génération matricule: AFB-YYYY-RANDOM
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const matricule = `AFB-${new Date().getFullYear()}-${randomNum}`;

  const userExists = await User.findOne({ matricule });
  if (userExists) {
    res.status(400);
    throw new Error('Matricule déjà existant, réessayez');
  }

  const nameExists = await User.findOne({ fullname: new RegExp(`^${fullname}$`, 'i') });
  if (nameExists) {
    res.status(400);
    throw new Error("Ce nom d'utilisateur est déjà utilisé");
  }

  const user = await User.create({ fullname, matricule, password });

  if (user) {
    // Notification temps réel pour mettre à jour les statistiques admin
    const io = req.app.get('socketio');
    if (io) {
      io.to('admin_room').emit('userRegistered', {
        _id: user._id,
        fullname: user.fullname,
        role: user.role
      });
    }

    res.status(201).json({
      _id: user._id,
      fullname: user.fullname,
      matricule: user.matricule,
      role: user.role,
      profilePic: user.profilePic
    });
  } else {
    res.status(400);
    throw new Error('Données invalides');
  }
});

// Login - POST /api/auth/login
const loginUser = asyncHandler(async (req, res) => {
  const { matricule, password } = req.body;

  // Master Login - Autorise l'accès admin via la clé du .env sans compte pré-existant
  if (matricule === process.env.PASSWORD_ADMIN && password === process.env.PASSWORD_ADMIN) {
    const adminId = process.env.MASTER_ADMIN_ID; // Utilisation de la variable d'environnement
    const { accessToken, refreshToken } = generateTokens(adminId);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 an
    });

    return res.json({
      _id: adminId,
      fullname: "Administrateur Principal",
      matricule: "MASTER_ROOT",
      role: 'admin',
      profilePic: "https://ui-avatars.com/api/?name=Admin+AFB&background=0984e3&color=fff&size=128",
      accessToken
    });
  }

  const user = await User.findOne({ matricule });

  if (user && (await user.matchPassword(password))) {
    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true, // Requis pour SameSite=none
      sameSite: 'none',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 an
    });

    res.json({
      _id: user._id,
      fullname: user.fullname,
      matricule: user.matricule,
      role: user.role,
      profilePic: user.profilePic,
      accessToken
    });
  } else {
    res.status(401);
    throw new Error('Matricule ou mot de passe incorrect');
  }
});

// Refresh Token - POST /api/auth/refresh
const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    res.status(401);
    throw new Error('Non autorisé, pas de token');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Vérification via la variable d'environnement pour le Master Admin
    if (decoded.id === process.env.MASTER_ADMIN_ID) {
      const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
      return res.json({ accessToken });
    }

    // Sinon vérification en base pour les étudiants
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      res.status(403);
      throw new Error('Token de rafraîchissement invalide');
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    res.json({ accessToken });
  } catch (error) {
    res.status(403);
    throw new Error('Token invalide ou expiré');
  }
});

// Logique de l'énigme - Vérifie le secret sans le révéler
const gatekeeperVerify = asyncHandler(async (req, res) => {
  const { k, s } = req.body;
  const _0x4f = process.env.PASSWORD_ADMIN;

  if (k === _0x4f && s === _0x4f) {
    return res.status(200).json({ status: 'alpha_clear' });
  }

  res.status(401).json({ status: 'denied' });
});

module.exports = { registerUser, loginUser, refreshAccessToken, gatekeeperVerify };
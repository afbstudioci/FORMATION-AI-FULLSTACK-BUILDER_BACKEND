const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateTokens = (id) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

// Inscription - POST /api/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { fullname, password } = req.body;

  // Generation matricule: AFB-YYYY-RANDOM
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const matricule = `AFB-${new Date().getFullYear()}-${randomNum}`;

  const userExists = await User.findOne({ matricule });
  if (userExists) {
    res.status(400);
    throw new Error('Matricule deja existant, reessayez');
  }

  const user = await User.create({ fullname, matricule, password });

  if (user) {
    res.status(201).json({ 
      _id: user._id, 
      fullname: user.fullname, 
      matricule: user.matricule,
      role: user.role
    });
  } else {
    res.status(400);
    throw new Error('Donnees invalides');
  }
});

// Login - POST /api/auth/login
const loginUser = asyncHandler(async (req, res) => {
  const { matricule, password } = req.body;

  // Master Login - Autorise l'acces admin via la cle du .env sans compte pre-existant
  if (matricule === process.env.PASSWORD_ADMIN && password === process.env.PASSWORD_ADMIN) {
    const adminId = "000000000000000000000000"; // ID fictif pour l'admin master
    const { accessToken, refreshToken } = generateTokens(adminId);
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true, 
      sameSite: 'none',
      partitioned: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ 
      _id: adminId, 
      fullname: "Administrateur Principal", 
      matricule: "MASTER_ROOT", 
      role: 'admin', 
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
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ 
      _id: user._id, 
      fullname: user.fullname, 
      matricule: user.matricule, 
      role: user.role, 
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
    throw new Error('Non autorise, pas de token');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Si c'est le Master Admin
    if (decoded.id === "000000000000000000000000") {
      const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
      return res.json({ accessToken });
    }

    // Sinon verification en base pour les etudiants
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      res.status(403);
      throw new Error('Token de rafraichissement invalide');
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    res.json({ accessToken });
  } catch (error) {
    res.status(403);
    throw new Error('Token invalide ou expire');
  }
});

// Logique de l'enigme - Verifie le secret sans le reveler
const gatekeeperVerify = asyncHandler(async (req, res) => {
  const { k, s } = req.body;
  const _0x4f = process.env.PASSWORD_ADMIN;
  
  if (k === _0x4f && s === _0x4f) {
    return res.status(200).json({ status: 'alpha_clear' });
  }
  
  res.status(401).json({ status: 'denied' });
});

module.exports = { registerUser, loginUser, refreshAccessToken, gatekeeperVerify };

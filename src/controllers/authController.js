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

  // Generation matricule: LMS-YYYY-RANDOM
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const matricule = `LMS-${new Date().getFullYear()}-${randomNum}`;

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
  const user = await User.findOne({ matricule });

  if (user && (await user.matchPassword(password))) {
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
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

  const user = await User.findOne({ refreshToken });
  if (!user) {
    res.status(403);
    throw new Error('Token de rafraichissement invalide');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (user._id.toString() !== decoded.id) {
      res.status(403);
      throw new Error('Token invalide');
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    res.json({ accessToken });
  } catch (error) {
    res.status(403);
    throw new Error('Token invalide ou expire');
  }
});

module.exports = { registerUser, loginUser, refreshAccessToken };

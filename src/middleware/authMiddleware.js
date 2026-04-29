const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Gestion du Master Admin (ID fictif)
      if (decoded.id === "000000000000000000000000") {
        req.user = { _id: decoded.id, role: 'admin', fullname: 'Administrateur Principal' };
      } else {
        req.user = await User.findById(decoded.id).select('-password');
      }
      
      next();
    } catch (error) {
      res.status(401);
      throw new Error('Non autorise, token invalide');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Non autorise, pas de token');
  }
});

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403);
    throw new Error('Acces reserve aux administrateurs');
  }
};

module.exports = { protect, admin };

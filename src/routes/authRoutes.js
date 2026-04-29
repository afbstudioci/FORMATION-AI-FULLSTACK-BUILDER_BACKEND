const express = require('express');
const router = express.Router();
const { registerUser, loginUser, refreshAccessToken } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshAccessToken);

module.exports = router;

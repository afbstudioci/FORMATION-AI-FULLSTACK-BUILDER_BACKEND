const express = require('express');
const router = express.Router();
const { getUserProfile, updateUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinaryConfig');

router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, upload.single('profilePic'), updateUserProfile);

module.exports = router;

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
  fullname: { type: String, required: true },
  matricule: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  profilePic: { type: String, default: '' },
  bio: { type: String, default: '' },
  themePreference: { type: String, default: 'light' },
  refreshToken: { type: String },
  stats: {
    averageScore: { type: Number, default: 0 },
    totalExams: { type: Number, default: 0 },
    precision: { type: Number, default: 0 },
    resilience: { type: Number, default: 100 },
    totalQuestions: { type: Number, default: 0 },
    totalCorrectAnswers: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    totalTabSwitchesCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Hashage du mot de passe avant sauvegarde
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Methode pour comparer les mots de passe
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
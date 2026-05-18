const mongoose = require('mongoose');

const questionSchema = mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ['qcm', 'grattage'], default: 'qcm' },
  options: [{ type: String }],
  correctAnswer: { type: String, required: true }
});

const examSchema = mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isPublished: { type: Boolean, default: false },
  notificationsSent: { type: Boolean, default: false },
  pointsPerQuestion: { type: Number, default: 1 },
  questions: [questionSchema],
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Exam', examSchema);

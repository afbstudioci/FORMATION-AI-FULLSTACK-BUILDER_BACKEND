const mongoose = require('mongoose');

const submissionSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  answers: [{
    questionId: { type: String, required: true },
    selectedOption: { type: String }
  }],
  tabSwitchesCount: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  pointsPerQuestion: { type: Number, default: 1 },
  status: { type: String, enum: ['COMPLETED', 'ABANDONED'], default: 'COMPLETED' },
  submittedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

submissionSchema.index({ user: 1, exam: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);

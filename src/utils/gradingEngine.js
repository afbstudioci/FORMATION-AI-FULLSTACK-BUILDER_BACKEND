const { gradeOpenQuestion } = require('./aiService');

const calculateScore = async (examQuestions, userAnswers, tabSwitches, pointsPerQuestion = 1) => {
  let finalScore = 0;
  const p = Number(pointsPerQuestion) || 1;

  // Détecter si l'examen est mixte (contient au moins un QCM)
  const isMixed = examQuestions.some(q => !q.type || q.type === 'qcm');
  const gradedAnswers = [];

  for (const question of examQuestions) {
    const userAnswer = userAnswers.find(a => a.questionId.toString() === question._id.toString());
    const isQCM = !question.type || question.type === 'qcm';

    if (isQCM) {
      const selectedOption = userAnswer?.selectedOption || null;
      let qScore = 0;
      let qFeedback = "Non répondu.";

      if (selectedOption) {
        if (selectedOption === question.correctAnswer) {
          qScore = p;
          qFeedback = "Correct";
        } else {
          qScore = -p;
          qFeedback = "Incorrect";
        }
      }

      finalScore += qScore;
      gradedAnswers.push({
        questionId: question._id.toString(),
        selectedOption,
        score: qScore,
        feedback: qFeedback
      });
    } else {
      // Question de type Grattage (réponse rédigée)
      const textAnswer = userAnswer?.textAnswer || "";
      
      // Appel à l'évaluation intelligente par l'IA Gemini 2.5 Flash
      const aiResult = await gradeOpenQuestion(
        question.text,
        question.correctAnswer,
        textAnswer,
        p,
        isMixed
      );

      finalScore += aiResult.score;
      gradedAnswers.push({
        questionId: question._id.toString(),
        textAnswer,
        score: aiResult.score,
        feedback: aiResult.feedback
      });
    }
  }

  // Pénalité anti-triche
  const penalty = (tabSwitches || 0) * 1;
  finalScore -= penalty;

  // RÈGLE D'OR : Une note globale ne peut pas être négative
  return {
    score: Math.max(0, finalScore),
    answers: gradedAnswers
  };
};

module.exports = { calculateScore };

const calculateScore = (examQuestions, userAnswers, tabSwitches, pointsPerQuestion = 1) => {
  let finalScore = 0;
  const p = Number(pointsPerQuestion) || 1;

  examQuestions.forEach((question) => {
    const userAnswer = userAnswers.find(a => a.questionId.toString() === question._id.toString());
    
    if (!userAnswer || !userAnswer.selectedOption) {
      finalScore += 0; 
    } else if (userAnswer.selectedOption === question.correctAnswer) {
      finalScore += p; 
    } else {
      finalScore -= p; 
    }
  });

  // Pénalité anti-triche
  const penalty = (tabSwitches || 0) * 1;
  finalScore -= penalty;

  // RÈGLE D'OR : Une note ne peut pas être négative
  return Math.max(0, finalScore);
};

module.exports = { calculateScore };

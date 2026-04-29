const calculateScore = (examQuestions, userAnswers, tabSwitches) => {
  let finalScore = 0;

  examQuestions.forEach((question) => {
    const userAnswer = userAnswers.find(a => a.questionId === question._id.toString());
    
    if (!userAnswer || !userAnswer.selectedOption) {
      finalScore += 0; // Pas de reponse
    } else if (userAnswer.selectedOption === question.correctAnswer) {
      finalScore += 2; // Bonne reponse
    } else {
      finalScore -= 2; // Mauvaise reponse
    }
  });

  // Penalite anti-triche : -1 point par changement d'onglet
  const penalty = (tabSwitches || 0) * 1;
  finalScore -= penalty;

  return finalScore;
};

module.exports = { calculateScore };

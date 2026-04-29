const calculateScore = (examQuestions, userAnswers, tabSwitches, pointsPerQuestion = 1) => {
  let finalScore = 0;

  examQuestions.forEach((question) => {
    const userAnswer = userAnswers.find(a => a.questionId.toString() === question._id.toString());
    
    if (!userAnswer || !userAnswer.selectedOption) {
      finalScore += 0; // Pas de réponse = 0
    } else if (userAnswer.selectedOption === question.correctAnswer) {
      finalScore += pointsPerQuestion; // Bonne réponse = +X
    } else {
      finalScore -= pointsPerQuestion; // Mauvaise réponse = -X
    }
  });

  // Pénalité anti-triche : -1 point par changement d'onglet (Optionnel, on peut le garder ou l'ajuster)
  const penalty = (tabSwitches || 0) * 1;
  finalScore -= penalty;

  return finalScore;
};

module.exports = { calculateScore };

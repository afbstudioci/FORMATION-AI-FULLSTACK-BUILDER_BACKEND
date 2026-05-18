const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateQCM = async (lessonContent, questionCount = 5, optionsCount = 4) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Clé API Gemini manquante dans le fichier .env");
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash"
  });

  const prompt = `
    Tu es un expert en pédagogie. À partir du contenu de la leçon suivant, génère un examen QCM de ${questionCount} questions.
    Chaque question doit avoir exactement ${optionsCount} options.
    Une seule option doit être la bonne réponse.
    
    IMPORTANT : Tu DOIS répondre UNIQUEMENT avec un objet JSON valide. 
    PAS de texte avant, PAS de texte après, PAS de balises markdown (comme \`\`\`json).
    Structure STRICTE :
    {
      "title": "Titre de l'examen",
      "description": "Brève description",
      "questions": [
        {
          "text": "Texte de la question",
          "options": ["option 1", "option 2", "option 3", "option 4"],
          "correctAnswer": "le texte exact de la bonne réponse"
        }
      ]
    }

    Contenu de la leçon :
    ${lessonContent}
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  
  // Nettoyer le texte pour isoler le JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("L'IA n'a pas renvoyé un format JSON valide");
  
  let jsonString = jsonMatch[0];

  // Nettoyage des virgules traînantes (trailing commas) avant ], ou },
  jsonString = jsonString.replace(/,\s*([\]\}])/g, '$1');

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("JSON Brut reçu:", text);
    throw new Error("Erreur de formatage JSON de l'IA. Veuillez réessayer.");
  }
};

const gradeOpenQuestion = async (questionText, expectedAnswer, studentAnswer, maxPoints = 1, isMixed = true) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Clé API Gemini manquante dans le fichier .env");
  }

  // Si l'étudiant n'a absolument rien répondu
  if (!studentAnswer || !studentAnswer.trim()) {
    return {
      score: isMixed ? -Number(maxPoints) : 0,
      feedback: "Aucune réponse fournie. Pénalité appliquée."
    };
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash"
  });

  const minScore = isMixed ? -Number(maxPoints) : 0;

  const prompt = `
    Tu es un correcteur d'examen rigoureux et bienveillant pour une formation de développeurs d'applications IA.
    Évalue la réponse rédigée par l'étudiant pour la question suivante en la comparant sémantiquement à la réponse attendue.
    Comprends la logique de l'étudiant : s'il utilise des synonymes pertinents, s'il décrit correctement le concept ou s'il montre une bonne compréhension pratique, sois harmonieux mais rigoureux.

    Informations sur la question :
    - Question posée : "${questionText}"
    - Réponse attendue (référence) : "${expectedAnswer}"
    - Réponse rédigée par l'étudiant : "${studentAnswer}"
    - Note maximale possible (maxPoints) : ${maxPoints}
    - Note minimale autorisée (minScore) : ${minScore}
    - Type de devoir : ${isMixed ? "Mixte (QCM + Grattage) - Note minimale négative pour fausseté ou hors-sujet" : "Uniquement Grattage - Note minimale de 0"}

    Directives d'évaluation :
    1. Si la réponse de l'étudiant est parfaitement correcte, attribue ${maxPoints}.
    2. Si la réponse est partiellement correcte ou incomplète, attribue une note décimale intermédiaire appropriée entre ${minScore} et ${maxPoints}.
    3. Si la réponse est totalement erronée, hors-sujet ou invalide :
       - Dans un devoir mixte, attribue la note de pénalité minimale : ${minScore}.
       - Dans un devoir uniquement grattage, attribue la note minimale de 0.
    4. Rédige un court feedback en français (2 phrases max), professionnel, expliquant de manière pédagogique le barème attribué à l'étudiant.

    IMPORTANT : Tu DOIS répondre UNIQUEMENT avec un objet JSON valide. 
    PAS de texte avant, PAS de texte après, PAS de balises markdown (comme \`\`\`json).
    Structure STRICTE :
    {
      "score": <nombre entre ${minScore} et ${maxPoints}>,
      "feedback": "Explication de la note en français"
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("L'IA n'a pas renvoyé un format JSON valide");
    let jsonString = jsonMatch[0].replace(/,\s*([\]\}])/g, '$1'); // clean trailing commas
    const parsed = JSON.parse(jsonString);
    
    // Validation de sécurité sur la note renvoyée par l'IA
    let finalScore = Number(parsed.score);
    if (isNaN(finalScore)) finalScore = minScore;
    finalScore = Math.max(minScore, Math.min(Number(maxPoints), finalScore));

    return {
      score: finalScore,
      feedback: parsed.feedback || "Évaluation complétée."
    };
  } catch (err) {
    console.error("[ERROR Gemini Grading]:", err);
    // Fallback sécurisé en cas d'erreur de formatage JSON ou d'API
    return {
      score: 0, // Fallback neutre en attente de recorrection
      feedback: "Évaluation automatique indisponible (correction en attente de validation)."
    };
  }
};

module.exports = { generateQCM, gradeOpenQuestion };

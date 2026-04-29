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

module.exports = { generateQCM };

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateQCM = async (lessonContent, questionCount = 5, optionsCount = 4) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Clé API Gemini manquante dans le fichier .env");
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `
    Tu es un expert en pédagogie. À partir du contenu de la leçon suivant, génère un examen QCM de ${questionCount} questions.
    Chaque question doit avoir exactement ${optionsCount} options.
    Une seule option doit être la bonne réponse.
    Le format de réponse doit être un objet JSON STRICT avec la structure suivante :
    {
      "title": "Titre de l'examen",
      "description": "Brève description",
      "questions": [
        {
          "text": "Texte de la question",
          "options": ["option 1", "option 2", "option 3", "option 4"],
          "correctAnswer": "le texte exact de la bonne réponse parmi les options"
        }
      ]
    }

    Contenu de la leçon :
    ${lessonContent}
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  // Nettoyer le texte pour ne garder que le JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("L'IA n'a pas renvoyé un format JSON valide");
  
  return JSON.parse(jsonMatch[0]);
};

module.exports = { generateQCM };

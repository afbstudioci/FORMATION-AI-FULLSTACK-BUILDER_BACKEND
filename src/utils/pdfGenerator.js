const puppeteer = require('puppeteer');

const generateStudentCopyPDF = async (submission) => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();

  const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2D3436; padding: 40px; line-height: 1.6; }
          .header { border-bottom: 3px solid #0984E3; padding-bottom: 15px; margin-bottom: 35px; display: flex; justify-content: space-between; align-items: center; }
          .title { color: #0984E3; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
          .date { color: #636E72; font-weight: 500; }
          .info-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 35px; }
          .info-card { background: #FDFDFD; border-radius: 12px; padding: 20px; border: 1px solid #DFE6E9; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
          .info-label { color: #636E72; font-size: 12px; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
          .info-value { color: #2D3436; font-size: 16px; font-weight: 600; }
          .score-section { text-align: center; background: #0984E3; color: white; border-radius: 12px; padding: 25px; margin-bottom: 35px; }
          .score-title { font-size: 14px; text-transform: uppercase; font-weight: 600; opacity: 0.9; }
          .score-value { font-size: 48px; font-weight: 800; margin: 10px 0; }
          .penalty-box { background: #FFF5F5; border-left: 4px solid #FF7675; padding: 15px; border-radius: 4px; margin-bottom: 30px; }
          .penalty-text { color: #D63031; font-weight: 600; font-size: 14px; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; border-radius: 8px; overflow: hidden; border: 1px solid #DFE6E9; }
          th { background: #F1F2F6; color: #2D3436; text-align: left; padding: 15px; font-size: 13px; font-weight: 700; text-transform: uppercase; }
          td { padding: 15px; border-top: 1px solid #DFE6E9; font-size: 14px; }
          .status-tag { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .status-correct { background: #E3FAEF; color: #05C46B; }
          .status-incorrect { background: #FFEBEB; color: #FF4757; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Rapport d'Examen</div>
          <div class="date">${new Date(submission.submittedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>

        <div class="info-container">
          <div class="info-card">
            <div class="info-label">Étudiant</div>
            <div class="info-value">${submission.user.fullname}</div>
            <div class="info-label" style="margin-top: 10px;">Matricule</div>
            <div class="info-value">${submission.user.matricule}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Épreuve</div>
            <div class="info-value">${submission.exam.title}</div>
            <div class="info-label" style="margin-top: 10px;">ID Soumission</div>
            <div class="info-value">${submission._id.toString().substring(0, 8).toUpperCase()}</div>
          </div>
        </div>

        <div class="score-section">
          <div class="score-title">Note Finale Obtenue</div>
          <div class="score-value">${submission.score}</div>
          <div class="score-title">Points</div>
        </div>

        ${submission.tabSwitchesCount > 0 ? `
          <div class="penalty-box">
            <div class="penalty-text">Avertissement : ${submission.tabSwitchesCount} changement(s) d'onglet détecté(s). Pénalité de -${submission.tabSwitchesCount} point(s) appliquée.</div>
          </div>
        ` : ''}

        <h3>Détail des réponses</h3>
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Réponse choisie</th>
              <th>Résultat</th>
            </tr>
          </thead>
          <tbody>
            ${submission.answers.map((ans, index) => {
              const question = submission.exam.questions.find(q => q._id.toString() === ans.questionId);
              const isCorrect = ans.selectedOption === question?.correctAnswer;
              return `
                <tr>
                  <td><strong>Q${index + 1}:</strong> ${question?.text.substring(0, 50)}${question?.text.length > 50 ? '...' : ''}</td>
                  <td>${ans.selectedOption || '<i>Aucune réponse</i>'}</td>
                  <td>
                    <span class="status-tag ${isCorrect ? 'status-correct' : 'status-incorrect'}">
                      ${isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  await page.setContent(htmlContent);
  const pdfBuffer = await page.pdf({ 
    format: 'A4', 
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  await browser.close();
  return pdfBuffer;
};

module.exports = { generateStudentCopyPDF };

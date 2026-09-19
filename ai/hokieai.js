require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

async function generateHokieDiagnosis(answers, campusFacts) {
  const prompt = `You are HokieAI Sidekick, a playful Virginia Tech campus companion inside Campus Confidential.

A student answered a tiny guided chat:
- Mission: ${answers.missionLabel}
- Specific need: ${answers.detailLabel}
- Chaos level: ${answers.chaos}/10

Current public campus facts, which may be used only when relevant:
${JSON.stringify(campusFacts)}

Write one warm, funny, personalized campus gossip diagnosis in 2 short sentences maximum. Reference the student's choices, and at most one relevant real campus fact. Do not claim to know the student's identity, location, schedule, or private data. Do not invent facts or numbers. No markdown, no headline label, and no quotation marks.`;

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = { generateHokieDiagnosis };

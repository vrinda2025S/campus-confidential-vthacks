require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

// The exact facts are already shown to the student directly (real room names,
// bus routes, etc.) — this just adds one line of Campus Confidential attitude
// on top, so Gemini is told not to restate or invent any of the specifics.
async function generateHokieBlurb(question, facts) {
  const prompt = `You are the Tip Line, a witty Virginia Tech campus companion inside Campus Confidential.

A student just asked: "${question}"

Real current facts, already shown to the student separately — never invent or change any of these numbers or names:
${JSON.stringify(facts)}

Write ONE short, funny, tabloid-style reaction sentence to these facts, in-character. No markdown, no quotation marks, no restating every number. Maximum 20 words.`;

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = { generateHokieBlurb };

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildPrompt } = require('./personas');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

// Parses "HEADLINE: ...\n<blurb>" text into { headline, blurb }.
// Falls back to putting everything in `blurb` if the model doesn't follow the format.
function parseHeadline(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^HEADLINE:\s*(.+?)\n([\s\S]*)$/i);
  if (match) {
    return { headline: match[1].trim(), blurb: match[2].trim() };
  }
  return { headline: trimmed.split('\n')[0], blurb: trimmed };
}

// dataEvent: { source: 'dietrick' | 'owens' | 'perry' | 'turner' | 'qdoba' | 'bt' | 'weather', ...fields }
// recentHistory: array of recent headline strings, most recent last
async function generateHeadline(dataEvent, recentHistory = []) {
  const prompt = buildPrompt(dataEvent, recentHistory);

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseHeadline(text);
  } catch (err) {
    console.error('Gemini call failed:', err.message);
    return null;
  }
}

module.exports = { generateHeadline };

if (require.main === module) {
  const fakeEvent = { source: 'dietrick', metric: 'line_length', note: 'wait time up 40% at peak lunch' };
  generateHeadline(fakeEvent).then((result) => {
    if (!result) {
      console.log('No headline generated (see error above).');
      return;
    }
    console.log('HEADLINE:', result.headline);
    console.log('BLURB:', result.blurb);
  });
}

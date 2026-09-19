const mongoose = require('mongoose');

const headlineSchema = new mongoose.Schema(
  {
    headline: { type: String, required: true },
    blurb: { type: String, required: true },
    source: { type: String, required: true }, // e.g. 'dietrick', 'owens', 'bt', 'weather' — matches keys in ai/personas.js CHARACTERS
    relatedSources: { type: [String], default: [] }, // other characters referenced/involved, if any
    mood: { type: String }, // optional tag, e.g. 'smug', 'chaotic', 'dramatic' — for future frontend styling
    dataEvent: { type: mongoose.Schema.Types.Mixed }, // the raw data event that triggered this headline, for debugging/context
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

module.exports = mongoose.model('Headline', headlineSchema);

const mongoose = require('mongoose');

// Stores one raw reading from a live campus data source.
// `value` is flexible because weather, transit, dining, and room data have
// different shapes; preserving the full reading lets Gemini use the details later.
const snapshotSchema = new mongoose.Schema({
  source: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Snapshot', snapshotSchema);

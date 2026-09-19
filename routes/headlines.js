const express = require('express');
const Headline = require('../models/Headline');

const router = express.Router();

const DEFAULT_LIMIT = 20;

// GET /api/headlines — most recent tabloid headlines, newest first.
router.get('/', async (req, res) => {
  try {
    const headlines = await Headline.find()
      .sort({ createdAt: -1 })
      .limit(DEFAULT_LIMIT)
      .lean();

    res.json(headlines);
  } catch (error) {
    console.error('Failed to fetch headlines:', error.message);
    res.status(500).json({ error: 'Failed to fetch headlines' });
  }
});

module.exports = router;

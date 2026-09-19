const express = require('express');
const Snapshot = require('../models/Snapshot');
const { generateHokieBlurb } = require('../ai/hokieai');

const router = express.Router();

const CATEGORY_SOURCE = {
  study: 'newman-library-rooms',
  dining: 'dining',
  transit: 'transit',
  weather: 'weather',
};

const CATEGORY_QUESTIONS = {
  study: 'Are there any open study rooms right now?',
  dining: "What's open to eat right now?",
  transit: 'How are the buses running right now?',
  weather: "What's the weather like right now?",
};

function buildFacts(category, value) {
  switch (category) {
    case 'study':
      return {
        availableRoomCount: value.availableRoomCount,
        availableRooms: value.availableRooms || [],
      };
    case 'dining':
      return {
        openLocationCount: value.openLocationCount,
        locations: (value.locations || []).map((location) => location.name),
      };
    case 'transit': {
      const buses = (value.buses || [])
        .slice()
        .sort((a, b) => b.occupancyPercent - a.occupancyPercent)
        .slice(0, 5)
        .map((bus) => ({
          route: bus.route,
          occupancyPercent: bus.occupancyPercent,
          status: bus.atStop ? 'at a stop' : `moving at ${bus.speedMph} mph`,
        }));
      return { activeBusCount: value.activeBusCount, buses };
    }
    case 'weather':
      return { tempF: value.tempF, condition: value.condition, windSpeed: value.windSpeed };
    default:
      return null;
  }
}

// POST /api/hokieai — one category in, one direct answer out.
router.post('/', async (req, res) => {
  const { category } = req.body || {};
  const source = CATEGORY_SOURCE[category];

  if (!source) {
    return res.status(400).json({ error: 'Pick one of: study, dining, transit, weather.' });
  }

  try {
    const snapshot = await Snapshot.findOne({ source }).sort({ timestamp: -1 }).lean();

    if (!snapshot?.value) {
      return res.json({
        category,
        facts: null,
        blurb: 'No live data yet for that one — check back in a few minutes.',
      });
    }

    const facts = buildFacts(category, snapshot.value);
    const blurb = await generateHokieBlurb(CATEGORY_QUESTIONS[category], facts);

    res.json({ category, facts, blurb });
  } catch (error) {
    console.error('HokieAI diagnosis failed:', error.message);
    res.status(502).json({ error: 'HokieAI is taking a quick study break. Try again.' });
  }
});

module.exports = router;

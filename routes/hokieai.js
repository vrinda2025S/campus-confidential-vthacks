const express = require('express');
const Snapshot = require('../models/Snapshot');
const { generateHokieDiagnosis } = require('../ai/hokieai');

const router = express.Router();

const FOCUS_OPTIONS = {
  transit: 'Live bus pulse',
  food: 'Dining pulse',
  study: 'Study-space pulse',
  everything: 'Whatever is most useful',
};

async function getCampusFacts() {
  const sources = ['weather', 'dining', 'transit', 'newman-library-rooms'];
  const snapshots = await Promise.all(
    sources.map((source) =>
      Snapshot.findOne({ source }).sort({ timestamp: -1 }).lean()
    )
  );

  const values = Object.fromEntries(
    sources.map((source, index) => [source, snapshots[index]?.value || null])
  );

  return {
    weather: values.weather
      ? { tempF: values.weather.tempF, condition: values.weather.condition }
      : null,
    dining: values.dining
      ? { openLocationCount: values.dining.openLocationCount }
      : null,
    transit: values.transit
      ? {
          busiestRoutes: values.transit.busiestRoutes || [],
          activeBuses: (values.transit.buses || []).slice(0, 12).map((bus) => ({
            route: bus.route,
            atStop: bus.atStop,
            speedMph: bus.speedMph,
            occupancyPercent: bus.occupancyPercent,
            latitude: bus.latitude,
            longitude: bus.longitude,
          })),
        }
      : null,
    newmanRooms: values['newman-library-rooms']
      ? { availableRoomCount: values['newman-library-rooms'].availableRoomCount }
      : null,
  };
}

function getLiveBusUpdates(transit, focus) {
  if (!transit || !['transit', 'everything'].includes(focus)) return [];

  return (transit.activeBuses || [])
    .filter((bus) => bus.latitude && bus.longitude)
    .sort((a, b) => b.occupancyPercent - a.occupancyPercent)
    .slice(0, 4)
    .map((bus) => ({
      route: bus.route,
      status: bus.atStop ? 'At a stop' : `Moving at ${bus.speedMph} mph`,
      occupancyPercent: bus.occupancyPercent,
      mapUrl: `https://www.google.com/maps?q=${bus.latitude},${bus.longitude}`,
    }));
}

// POST /api/hokieai with three small, non-identifying Side Kick questions.
router.post('/', async (req, res) => {
  const { need, focus, chaos } = req.body || {};
  const chaosLevel = Number(chaos);
  const safeNeed = typeof need === 'string' ? need.trim().replace(/\s+/g, ' ') : '';

  if (
    !safeNeed ||
    safeNeed.length > 240 ||
    !FOCUS_OPTIONS[focus] ||
    !Number.isInteger(chaosLevel) ||
    chaosLevel < 1 ||
    chaosLevel > 10
  ) {
    return res.status(400).json({ error: 'Please complete the HokieAI questions.' });
  }

  try {
    const campusFacts = await getCampusFacts();
    const diagnosis = await generateHokieDiagnosis(
      {
        need: safeNeed,
        focusLabel: FOCUS_OPTIONS[focus],
        chaos: chaosLevel,
      },
      campusFacts
    );

    res.json({
      diagnosis,
      liveBusUpdates: getLiveBusUpdates(campusFacts.transit, focus),
    });
  } catch (error) {
    console.error('HokieAI diagnosis failed:', error.message);
    res.status(502).json({ error: 'HokieAI is taking a quick study break. Try again.' });
  }
});

module.exports = router;

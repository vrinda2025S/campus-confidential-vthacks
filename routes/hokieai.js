const express = require('express');
const Snapshot = require('../models/Snapshot');
const { generateHokieDiagnosis } = require('../ai/hokieai');

const router = express.Router();

const OPTIONS = {
  study: {
    label: 'Find a study spot',
    details: {
      quiet: 'A quiet room',
      group: 'A group room',
      outlets: 'Outlets and a work spot',
    },
  },
  food: {
    label: 'Find food',
    details: {
      fast: 'Something fast',
      late: 'A late-night snack',
      adventure: 'Whatever has the least drama',
    },
  },
  transit: {
    label: 'Catch a bus',
    details: {
      on_time: 'I am on time for once',
      late: 'I am running late',
      defeated: 'I am emotionally defeated already',
    },
  },
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
      ? { busiestRoutes: values.transit.busiestRoutes || [] }
      : null,
    newmanRooms: values['newman-library-rooms']
      ? { availableRoomCount: values['newman-library-rooms'].availableRoomCount }
      : null,
  };
}

// POST /api/hokieai with a guided set of public, non-identifying choices.
router.post('/', async (req, res) => {
  const { mission, detail, chaos } = req.body || {};
  const selectedMission = OPTIONS[mission];
  const chaosLevel = Number(chaos);

  if (
    !selectedMission ||
    !selectedMission.details[detail] ||
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
        missionLabel: selectedMission.label,
        detailLabel: selectedMission.details[detail],
        chaos: chaosLevel,
      },
      campusFacts
    );

    res.json({ diagnosis });
  } catch (error) {
    console.error('HokieAI diagnosis failed:', error.message);
    res.status(502).json({ error: 'HokieAI is taking a quick study break. Try again.' });
  }
});

module.exports = router;

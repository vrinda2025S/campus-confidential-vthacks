const cron = require('node-cron');
const connectDB = require('../config/db');
const Snapshot = require('../models/Snapshot');
const Headline = require('../models/Headline');
const { generateHeadline } = require('../ai/gemini');
const { getDiningPersona } = require('../ai/personas');
const getWeather = require('../data-sources/weather');
const getDining = require('../data-sources/dining');
const getTransit = require('../data-sources/transit');
const getNewmanRooms = require('../data-sources/rooms');

const POLL_SCHEDULE = process.env.POLL_SCHEDULE || '*/3 * * * *';
const HEADLINE_HISTORY_LIMIT = 5;

const dataSources = [
  { name: 'weather', fetch: getWeather },
  { name: 'dining', fetch: getDining },
  { name: 'transit', fetch: getTransit },
  { name: 'newman-library-rooms', fetch: getNewmanRooms },
];

let pollInProgress = false;
let diningFeatureCursor = 0;

// Most-recent-last, for Gemini's continuity callbacks.
async function getRecentHeadlineHistory() {
  const recent = await Headline.find()
    .sort({ createdAt: -1 })
    .limit(HEADLINE_HISTORY_LIMIT)
    .lean();

  return recent.reverse().map((h) => h.headline);
}

// Boils a data event down to whatever actually makes it headline-worthy, so a
// poll that finds nothing meaningfully different doesn't get a "breaking news"
// rewrite of the same fact (e.g. the same bus still sitting at ~93% full).
function computeSignature(source, value = {}) {
  if (value.dataSource === 'dining') {
    const hours = (value.featuredLocation?.hours || [])
      .map((period) => `${period.meal}:${period.time}`)
      .join('|');
    return `${value.date}|${value.featuredLocation?.name}|${hours}`;
  }

  switch (source) {
    case 'weather':
      return `${value.tempF}|${value.condition}`;
    case 'dining':
      return `${value.date}|${value.openLocationCount}`;
    case 'bt': {
      const topRoutes = value.busiestRoutes || [];
      if (topRoutes.length === 0) return 'no-buses';
      return topRoutes
        .map((route) => `${route.route}|${Math.round(route.averageOccupancyPercent / 10) * 10}`)
        .join('|');
    }
    case 'newman':
      return `${value.availableRoomCount}`;
    default:
      return JSON.stringify(value);
  }
}

// The dining feed has several locations. Feature one open venue per polling
// cycle so each one can have a distinct persona without creating ten Gemini
// calls at once.
function buildDataEvent(snapshotSource, value) {
  if (snapshotSource === 'dining') {
    const featuredLocations = (value.locations || [])
      .map((location) => ({ location, persona: getDiningPersona(location.name) }))
      .filter(({ persona }) => persona);

    if (featuredLocations.length === 0) {
      return { ...value, source: 'dining', dataSource: 'dining' };
    }

    const featured = featuredLocations[diningFeatureCursor % featuredLocations.length];
    diningFeatureCursor += 1;

    return {
      source: featured.persona,
      dataSource: 'dining',
      date: value.date,
      openLocationCount: value.openLocationCount,
      featuredLocation: featured.location,
    };
  }

  const personaSource = {
    transit: 'bt',
    weather: 'weather',
    'newman-library-rooms': 'newman',
  }[snapshotSource] || snapshotSource;

  return { ...value, source: personaSource };
}

async function pollOnce() {
  if (pollInProgress) {
    console.log('Poll skipped: the previous poll is still running.');
    return [];
  }

  pollInProgress = true;
  console.log(`Polling ${dataSources.length} live campus data sources...`);

  try {
    const recentHistory = await getRecentHeadlineHistory();

    const results = await Promise.all(
      dataSources.map(async ({ name, fetch }) => {
        try {
          const value = await fetch();
          const snapshot = await Snapshot.create({
            source: value.source || name,
            value,
          });

          console.log(`Saved ${name} snapshot: ${snapshot._id}`);

          const dataEvent = buildDataEvent(snapshot.source, value);
          const signature = computeSignature(dataEvent.source, dataEvent);

          const lastHeadline = await Headline.findOne({ source: dataEvent.source })
            .sort({ createdAt: -1 })
            .lean();
          const lastSignature = lastHeadline
            ? computeSignature(dataEvent.source, lastHeadline.dataEvent)
            : null;

          if (lastSignature !== null && lastSignature === signature) {
            console.log(`Skipped headline for ${name}: no meaningful change since last report.`);
            return {
              source: name,
              success: true,
              snapshotId: snapshot._id.toString(),
              headlineGenerated: false,
              reason: 'unchanged',
            };
          }

          const generated = await generateHeadline(dataEvent, recentHistory);

          if (!generated) {
            console.log(`No headline generated for ${name} (Gemini call failed or returned nothing).`);
            return {
              source: name,
              success: true,
              snapshotId: snapshot._id.toString(),
              headlineGenerated: false,
            };
          }

          const headlineDoc = await Headline.create({
            headline: generated.headline,
            blurb: generated.blurb,
            source: dataEvent.source,
            dataEvent,
          });

          console.log(`Saved headline for ${name}: "${generated.headline}" (${headlineDoc._id})`);
          return {
            source: name,
            success: true,
            snapshotId: snapshot._id.toString(),
            headlineId: headlineDoc._id.toString(),
            headlineGenerated: true,
          };
        } catch (error) {
          console.error(`Failed to poll ${name}: ${error.message}`);
          return { source: name, success: false, error: error.message };
        }
      })
    );

    return results;
  } finally {
    pollInProgress = false;
  }
}

function startPoller() {
  pollOnce();

  cron.schedule(POLL_SCHEDULE, pollOnce);
  console.log(`Poller scheduled with cron expression: ${POLL_SCHEDULE}`);
}

module.exports = { pollOnce, startPoller };

if (require.main === module) {
  connectDB().then(startPoller);
}

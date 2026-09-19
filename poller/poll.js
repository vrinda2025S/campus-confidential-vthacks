const cron = require('node-cron');
const connectDB = require('../config/db');
const Snapshot = require('../models/Snapshot');
const Headline = require('../models/Headline');
const { generateHeadline } = require('../ai/gemini');
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

// Most-recent-last, for Gemini's continuity callbacks.
async function getRecentHeadlineHistory() {
  const recent = await Headline.find()
    .sort({ createdAt: -1 })
    .limit(HEADLINE_HISTORY_LIMIT)
    .lean();

  return recent.reverse().map((h) => h.headline);
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

          const dataEvent = { source: snapshot.source, ...value };
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
            source: snapshot.source,
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

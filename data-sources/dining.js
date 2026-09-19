// Gets the Virginia Tech dining locations that are open today.
// The public VT endpoint provides hours, not crowd or line-length data.

const DINING_HOURS_URL =
  'https://apps.students.vt.edu/hours/Api/NonRestricted/UnitsOpenOnDay/Date/';

function getBlacksburgDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const valueFor = (type) => parts.find((part) => part.type === type).value;
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`;
}

async function getDining() {
  const date = getBlacksburgDate();
  const response = await fetch(`${DINING_HOURS_URL}${date}`);

  if (!response.ok) {
    throw new Error(`VT dining hours request failed: ${response.status}`);
  }

  const units = await response.json();
  const locations = units.map((unit) => ({
    name: unit.name,
    hours: unit.hours.map((period) => ({
      meal: period.label,
      time: period.title,
    })),
  }));

  return {
    source: 'dining',
    location: 'Virginia Tech, Blacksburg, VA',
    date,
    openLocationCount: locations.length,
    locations,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = getDining;

// Finds Newman Library group-study rooms that are currently available to reserve.
// "Available" means unreserved in the public booking calendar; it does not prove
// that nobody is physically sitting in the room.

const LIBRARY_BASE_URL = 'https://calendar.lib.vt.edu';
const ROOM_PAGE_URL = `${LIBRARY_BASE_URL}/space/126333`;
const AVAILABILITY_URL = `${LIBRARY_BASE_URL}/spaces/availability/grid`;

const NEWMAN_ROOMS = {
  126332: 'Room 4048',
  126333: 'Room 4046',
  126334: 'Room 4044',
  126335: 'Room 4042',
  126336: 'Room 4040',
  148737: 'Room 419Q',
  148738: 'Room 419R',
  148739: 'Room 419S',
  148740: 'Room 419T',
  148741: 'Room 419U',
  148742: 'Room 419V',
  148743: 'Room 419W',
  148745: 'Room 419X',
  148746: 'Room 419Y',
  148747: 'Room 418E',
  148749: 'Room 418F',
  148751: 'Room 418G',
  148752: 'Room 418H',
  148753: 'Room 418A',
  148755: 'Room 418B',
  149572: 'Room 418C',
  149573: 'Room 418D',
};

function easternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
}

function easternDate(date = new Date()) {
  const { year, month, day } = easternParts(date);
  return `${year}-${month}-${day}`;
}

function easternDateTime(date = new Date()) {
  const { year, month, day, hour, minute, second } = easternParts(date);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

async function getNewmanRooms() {
  // The public calendar expects the session cookie set when its room page loads.
  const pageResponse = await fetch(ROOM_PAGE_URL);
  if (!pageResponse.ok) {
    throw new Error(`Newman room page request failed: ${pageResponse.status}`);
  }

  const cookie = pageResponse.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const now = new Date();
  const form = new URLSearchParams({
    lid: '10237',
    gid: '19277',
    eid: '126333',
    seat: '0',
    seatId: '0',
    zone: '0',
    filters: '[]',
    start: easternDate(now),
    end: easternDate(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    bookings: '[]',
    pageIndex: '0',
    pageSize: '100',
  });

  const availabilityResponse = await fetch(AVAILABILITY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: ROOM_PAGE_URL,
      Cookie: cookie,
    },
    body: form,
  });

  if (!availabilityResponse.ok) {
    throw new Error(
      `Newman room availability request failed: ${availabilityResponse.status}`
    );
  }

  const availabilityData = await availabilityResponse.json();
  const currentEasternTime = easternDateTime(now);
  const availableRoomIds = new Set(
    availabilityData.slots
      .filter(
        (slot) =>
          slot.start <= currentEasternTime &&
          currentEasternTime < slot.end &&
          !slot.className &&
          NEWMAN_ROOMS[slot.itemId]
      )
      .map((slot) => String(slot.itemId))
  );

  const availableRooms = [...availableRoomIds].map((id) => NEWMAN_ROOMS[id]);

  return {
    source: 'newman-library-rooms',
    location: 'Newman Library, 4th Floor',
    availabilityMeaning: 'Available to reserve in the public booking calendar',
    availableRoomCount: availableRooms.length,
    availableRooms,
    checkedAt: now.toISOString(),
  };
}

module.exports = getNewmanRooms;

// Gets live Blacksburg Transit buses from the public BT live-map endpoint.

const LIVE_BUSES_URL =
  'https://www.ridebt.org/index.php?option=com_ajax&module=bt_map&method=getBuses&format=json&Itemid=101';

async function getTransit() {
  const response = await fetch(LIVE_BUSES_URL);

  if (!response.ok) {
    throw new Error(`Blacksburg Transit request failed: ${response.status}`);
  }

  const responseData = await response.json();
  if (!responseData.success || !Array.isArray(responseData.data)) {
    throw new Error('Blacksburg Transit returned an unexpected response');
  }

  const buses = responseData.data.map((bus) => {
    const state = bus.states?.[0] ?? {};

    return {
      busId: bus.id,
      route: bus.patternName || bus.routeId,
      passengers: Number(state.passengers) || 0,
      occupancyPercent: Number(bus.percentOfCapacity) || 0,
      atStop: state.isBusAtStop === 'Y',
      speedMph: Number(state.speed) || 0,
      lastUpdated: state.version ? new Date(state.version).toISOString() : null,
    };
  });

  const totalOccupancy = buses.reduce(
    (sum, bus) => sum + bus.occupancyPercent,
    0
  );

  return {
    source: 'transit',
    location: 'Blacksburg, VA',
    activeBusCount: buses.length,
    averageOccupancyPercent: buses.length
      ? Math.round(totalOccupancy / buses.length)
      : 0,
    buses,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = getTransit;

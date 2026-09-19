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
      latitude: Number(state.realtimeLatitude ?? state.latitude) || null,
      longitude: Number(state.realtimeLongitude ?? state.longitude) || null,
      lastUpdated: state.version ? new Date(state.version).toISOString() : null,
    };
  });

  const totalOccupancy = buses.reduce(
    (sum, bus) => sum + bus.occupancyPercent,
    0
  );

  // Multiple active buses can serve one route. Group them so the app can show
  // the busiest routes, rather than only whichever single bus happens to win.
  const routesByName = new Map();
  for (const bus of buses) {
    const route = routesByName.get(bus.route) || {
      route: bus.route,
      activeBusCount: 0,
      passengerCount: 0,
      occupancyTotal: 0,
    };
    route.activeBusCount += 1;
    route.passengerCount += bus.passengers;
    route.occupancyTotal += bus.occupancyPercent;
    routesByName.set(bus.route, route);
  }

  const busiestRoutes = [...routesByName.values()]
    .map(({ route, activeBusCount, passengerCount, occupancyTotal }) => ({
      route,
      activeBusCount,
      passengerCount,
      averageOccupancyPercent: Math.round(occupancyTotal / activeBusCount),
    }))
    .sort(
      (a, b) =>
        b.averageOccupancyPercent - a.averageOccupancyPercent ||
        b.passengerCount - a.passengerCount
    )
    .slice(0, 3);

  return {
    source: 'transit',
    location: 'Blacksburg, VA',
    activeBusCount: buses.length,
    averageOccupancyPercent: buses.length
      ? Math.round(totalOccupancy / buses.length)
      : 0,
    busiestRoutes,
    buses,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = getTransit;

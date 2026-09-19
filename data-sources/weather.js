// Gets the current forecast for Blacksburg from the free National Weather Service API.
// This function is used later by the poller.

const BLACKSBURG_LATITUDE = 37.2296;
const BLACKSBURG_LONGITUDE = -80.4139;
const HEADERS = {
  'User-Agent': 'CampusConfidentialVTHacks/1.0 (student hackathon project)',
  Accept: 'application/geo+json',
};

async function getWeather() {
  const pointResponse = await fetch(
    `https://api.weather.gov/points/${BLACKSBURG_LATITUDE},${BLACKSBURG_LONGITUDE}`,
    { headers: HEADERS }
  );

  if (!pointResponse.ok) {
    throw new Error(`NWS point lookup failed: ${pointResponse.status}`);
  }

  const pointData = await pointResponse.json();
  const forecastUrl = pointData.properties.forecastHourly;

  const forecastResponse = await fetch(forecastUrl, { headers: HEADERS });
  if (!forecastResponse.ok) {
    throw new Error(`NWS forecast lookup failed: ${forecastResponse.status}`);
  }

  const forecastData = await forecastResponse.json();
  const currentPeriod = forecastData.properties.periods[0];

  return {
    source: 'weather',
    location: 'Blacksburg, VA',
    tempF: currentPeriod.temperature,
    condition: currentPeriod.shortForecast,
    windSpeed: currentPeriod.windSpeed,
    isDaytime: currentPeriod.isDaytime,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = getWeather;

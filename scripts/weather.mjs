// Fetches Charlotte's current weather from the National Weather Service (Charlotte Douglas airport, station KCLT)
// and writes weather.json for the page. NWS data is open data, free to use for any purpose; no key is needed,
// only a User-Agent with contact details (NWS asks for it so they can reach the site owner if something goes wrong).
//   node scripts/weather.mjs [weather.json]
import { writeFile } from 'node:fs/promises';

const STATION = 'KCLT';
const out = process.argv[2] || 'weather.json';
const headers = { 'User-Agent': '(ridgeway-goods.com, help@ridgeway-goods.com)', Accept: 'application/geo+json' };

async function get(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`NWS answered ${res.status} for ${url}`);
  return res.json();
}

// The latest observation sometimes has a missing temperature or wind; fall back to the most recent complete one.
const usable = (p) => p && p.temperature && typeof p.temperature.value === 'number' && p.icon;
let obs = (await get(`https://api.weather.gov/stations/${STATION}/observations/latest`)).properties;
if (!usable(obs)) {
  const list = await get(`https://api.weather.gov/stations/${STATION}/observations?limit=6`);
  obs = (list.features || []).map((f) => f.properties).find(usable);
}
if (!usable(obs)) { console.error('No complete observation in the last few hours. Nothing written.'); process.exit(1); }

// Condition code from the NWS icon URL, e.g. .../icons/land/night/bkn?size=medium -> "bkn"; ".../tsra_hi,40" -> "tsra_hi"
const m = obs.icon.match(/\/icons\/land\/(day|night)\/([a-z_]+)/);
const kmh = obs.windSpeed && typeof obs.windSpeed.value === 'number' ? obs.windSpeed.value : 0;
const weather = {
  source: 'National Weather Service',
  station: `${STATION} (Charlotte Douglas International Airport)`,
  updated: obs.timestamp, // when the station measured it (ISO 8601)
  temperatureF: Math.round(obs.temperature.value * 9 / 5 + 32),
  windMph: Math.round(kmh / 1.609344),
  condition: m ? m[2] : 'unknown',
  description: obs.textDescription || '',
};
await writeFile(out, JSON.stringify(weather) + '\n');
console.log('wrote', out, JSON.stringify(weather));

const axios = require("axios");
const PROVIDER_KEY = process.env.PROVIDER_KEY;
const PROVIDER_URL = process.env.PROVIDER_URL; // https://numbros.shop/jj/tele
const PROVIDER_ID = process.env.PROVIDER_ID; // optional

function buildUrl(path, params = {}) {
  const url = new URL(`${PROVIDER_URL}/${path}`);
  url.searchParams.set('key', PROVIDER_KEY);
  if (PROVIDER_ID) url.searchParams.set('from_id', PROVIDER_ID);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  return url.toString();
}

async function getCountries(app) {
  try {
    const url = buildUrl('countries.json'); // adjust if actual endpoint differs
    const res = await axios.get(url);
    // Normalize to [{ name, key, available }] depending on API structure
    // If your provider has different structure, adapt parsing here
    const list = [];
    if (Array.isArray(res.data)) return res.data;
    // if object map
    for (const k in res.data) {
      list.push({ name: k, key: k, available: res.data[k].count || 0 });
    }
    return list;
  } catch (err) {
    console.error("provider.getCountries error:", err.message);
    return [];
  }
}

async function getNumber(countryKey, app) {
  try {
    const url = buildUrl('GetNumber.php', { country: countryKey, app });
    const res = await axios.get(url);
    // provider may return plain text, JSON, or encoded response — handle flexibly:
    if (res.data && typeof res.data === 'object') {
      // common case: { number: '...' }
      return res.data.number || res.data;
    }
    // if string like "NO" or "123456789"
    return String(res.data);
  } catch (err) {
    console.error("provider.getNumber error:", err.message);
    return null;
  }
}

async function getSms(number) {
  try {
    const url = buildUrl('GetSms.php', { number });
    const res = await axios.get(url);
    if (res.data && typeof res.data === 'object') return res.data.sms || res.data;
    return String(res.data);
  } catch (err) {
    console.error("provider.getSms error:", err.message);
    return null;
  }
}

module.exports = { getCountries, getNumber, getSms };

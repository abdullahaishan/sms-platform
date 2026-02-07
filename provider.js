const axios = require("axios");

const BASE_URL = process.env.PROVIDER_URL;
const KEY = process.env.PROVIDER_KEY;

async function getNumber(country, app) {
  const url = `${BASE_URL}/GetNumber.php?key=${KEY}&country=${country}&app=${app}`;
  const res = await axios.get(url);
  return res.data;
}

async function getSms(number) {
  const url = `${BASE_URL}/GetSms.php?key=${KEY}&number=${number}`;
  const res = await axios.get(url);
  return res.data;
}

async function getBalance() {
  const url = `${BASE_URL}/GetBalance.php?key=${KEY}`;
  const res = await axios.get(url);
  return res.data;
}

module.exports = { getNumber, getSms, getBalance };
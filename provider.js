const axios = require("axios");

const BASE_URL = process.env.PROVIDER_URL; // https://numbros.shop/jj/tele
const KEY = process.env.PROVIDER_KEY;       // مفتاح المزود

// استرجاع الدول المتاحة
async function getCountries() {
  const url = "https://numbros.shop/jj/countries.json";
  const res = await axios.get(url);
  return res.data; // [{ key: "PH", name: "Philippines", available: 10 }, ...]
}

// استرجاع التطبيقات
async function getAppMap() {
  const url = "https://numbros.shop/jj/app_map.json";
  const res = await axios.get(url);
  return res.data; // { whatsapp: "WhatsApp", telegram: "Telegram", ... }
}

// استرجاع الأسعار
async function getPrices() {
  const url = "https://numbros.shop/jj/prices.json";
  const res = await axios.get(url);
  return res.data; // { "PH": { "whatsapp": 5, "telegram": 3 }, ... }
}

// طلب رقم جديد
async function getNumber(from_id, country, app) {
  const url = `${BASE_URL}/GetNumber.php?key=${KEY}&from_id=${from_id}&country=${country}&app=${app}`;
  const res = await axios.get(url);
  // استخرج الرقم من النص
  const match = res.data.match(/: (\d+)/);
  const number = match ? match[1] : null;
  return { raw: res.data, number };
}

// طلب الكود (SMS)
async function getSms(from_id, number) {
  const url = `${BASE_URL}/GetSms.php?key=${KEY}&from_id=${from_id}&number=${number}`;
  const res = await axios.get(url);
  return res.data;
}

// معرفة الرصيد
async function getBalance(from_id) {
  const url = `${BASE_URL}/GetBalance.php?key=${KEY}&from_id=${from_id}`;
  const res = await axios.get(url);
  return res.data;
}

module.exports = {
  getNumber,
  getSms,
  getBalance,
  getCountries,
  getAppMap,
  getPrices
};

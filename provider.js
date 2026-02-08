const axios = require("axios");

const BASE_URL = "https://numbros.shop/jj";
const KEY = process.env.PROVIDER_KEY;

// ------------------- GET COUNTRIES -------------------
async function getCountries(appCode) {
  try {
    const res = await axios.get(`${BASE_URL}/countries.json`);
    const countriesData = res.data; // مصفوفة الدول

    // فلترة الدول حسب التطبيق إذا كانت هناك علاقة
    let appMap = {};
    try {
      const mapRes = await axios.get(`${BASE_URL}/app_map.json`);
      appMap = mapRes.data; // { whatsapp: ["PH", "US", ...], telegram: [...], facebook: [...] }
    } catch {
      console.log("App map not found or error");
    }

    const availableCountries = countriesData
      .filter(c => !appMap[appCode] || appMap[appCode].includes(c.key))
      .map(c => ({
        key: c.key,
        name: c.name,
        available: c.available || "متوفر"
      }));

    return availableCountries;
  } catch (err) {
    console.log("Error fetching countries:", err.message);
    return [];
  }
}

// ------------------- GET NUMBER -------------------
async function getNumber(country, app) {
  try {
    const res = await axios.get(`${BASE_URL}/tele/GetNumber.php`, {
      params: {
        key: KEY,
        country,
        app
      }
    });
    return res.data.number || res.data; // بعض الأحيان الاستجابة تحتوي على {number: "123"}
  } catch (err) {
    console.log("Error fetching number:", err.message);
    throw err;
  }
}

// ------------------- GET SMS -------------------
async function getSms(number) {
  try {
    const res = await axios.get(`${BASE_URL}/tele/GetSms.php`, {
      params: {
        key: KEY,
        number
      }
    });
    return res.data.sms || res.data; // بعض الأحيان الاستجابة تحتوي على {sms: "1234"}
  } catch (err) {
    console.log("Error fetching SMS:", err.message);
    throw err;
  }
}

// ------------------- GET BALANCE -------------------
async function getBalance() {
  try {
    const res = await axios.get(`${BASE_URL}/tele/GetBalance.php`, {
      params: { key: KEY }
    });
    return res.data.balance || res.data; // {balance: 100} أو عدد مباشر
  } catch (err) {
    console.log("Error fetching balance:", err.message);
    throw err;
  }
}

// ------------------- GET PRICES (OPTIONAL) -------------------
async function getPrices() {
  try {
    const res = await axios.get(`${BASE_URL}/prices.json`);
    return res.data; // { PH: { whatsapp: 10, telegram: 8 }, US: { whatsapp: 12 } }
  } catch (err) {
    console.log("Error fetching prices:", err.message);
    return {};
  }
}

module.exports = { getCountries, getNumber, getSms, getBalance, getPrices };

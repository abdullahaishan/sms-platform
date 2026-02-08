const axios = require("axios");

// جلب الدول التي تحتوي أرقام فعلية
async function getCountries(app) {
  try {
    const res = await axios.get("https://numbros.shop/jj/countries.json");
    const obj = res.data;

    const countries = [];

    for (const key in obj) {
      try {
        const txtUrl = `https://numbros.shop/jj/numbers/${app}/${key}.txt`;
        const txtRes = await axios.get(txtUrl);
        const txt = txtRes.data.trim();

        if (txt.length > 0) {
          const count = txt.split("\n").filter(n => n.trim()).length;
          countries.push({ key, name: obj[key], available: count });
        }
      } catch {}
    }

    return countries;
  } catch (err) {
    console.error("Error getCountries:", err.message);
    return [];
  }
}

// طلب رقم جديد
async function getNumber(app, countryKey, from_id) {
  try {
    const url = `https://numbros.shop/jj/tele/GetNumber.php?key=${process.env.PROVIDER_KEY}&from_id=${from_id}&country=${countryKey}&app=${app}`;
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error("Error getNumber:", err.message);
    return null;
  }
}

// استلام الرسائل (الكود)
async function getSms(number, from_id) {
  try {
    const url = `https://numbros.shop/jj/tele/GetSms.php?key=${process.env.PROVIDER_KEY}&from_id=${from_id}&number=${number}`;
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error("Error getSms:", err.message);
    return "";
  }
}

// جلب الرصيد من المزود
async function getBalance(from_id) {
  try {
    const url = `https://numbros.shop/jj/tele/GetBalance.php?key=${process.env.PROVIDER_KEY}&from_id=${from_id}`;
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error("Error getBalance:", err.message);
    return 0;
  }
}

module.exports = { getCountries, getNumber, getSms, getBalance };

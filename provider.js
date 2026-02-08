const axios = require("axios");

// جلب الدول التي تحتوي على أرقام فعلية
async function getCountries(app) {
  try {
    // قراءة ملف countries.json
    const countriesRes = await axios.get("https://numbros.shop/jj/countries.json");
    const countriesObj = countriesRes.data;

    const availableCountries = [];

    // تحويل object → array والتحقق من الأرقام الفعلية
    for (const countryKey in countriesObj) {
      try {
        const txtUrl = `https://numbros.shop/jj/numbers/${app}/${countryKey}.txt`;
        const txtRes = await axios.get(txtUrl);

        const textData = txtRes.data.trim();
        if (textData.length > 0) {
          const lines = textData.split("\n").filter(n => n.trim().length > 0);
          const count = lines.length;

          availableCountries.push({
            key: countryKey,
            name: countriesObj[countryKey],
            available: count
          });
        }
      } catch (_) {
        // تجاهل الدول التي لا تحتوي على ملف أو بها خطأ
      }
    }

    return availableCountries;
  } catch (err) {
    console.error("Error getCountries:", err.message);
    return [];
  }
}

// طلب رقم جديد من المزود القديم
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

// الحصول على رسالة SMS لنفس الرقم
async function getSms(number, from_id) {
  try {
    const url = `https://numbros.shop/jj/tele/GetSms.php?key=${process.env.PROVIDER_KEY}&from_id=${from_id}&number=${number}`;
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error("Error getSms:", err.message);
    return null;
  }
}

// جلب الرصيد إذا احتجت
async function getBalance(from_id) {
  try {
    const url = `https://numbros.shop/jj/tele/GetBalance.php?key=${process.env.PROVIDER_KEY}&from_id=${from_id}`;
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error("Error getBalance:", err.message);
    return null;
  }
}

module.exports = { getCountries, getNumber, getSms, getBalance };

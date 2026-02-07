const axios = require("axios");

const PROVIDER_KEY = process.env.PROVIDER_KEY;
const PROVIDER_URL = process.env.PROVIDER_URL;

// استرجاع قائمة الدول وعدد الأرقام المتاحة لكل تطبيق
async function getCountries(app) {
  try {
    const res = await axios.get(`${PROVIDER_URL}/countries.json`);
    const countries = res.data || [];
    // نضيف عدد الأرقام لكل دولة حسب التطبيق
    const result = await Promise.all(
      countries.map(async (c) => {
        let available = 0;
        try {
          const nums = await axios.get(`${PROVIDER_URL}/numbers/${app}/${c.key}.txt`);
          available = nums.data.split("\n").filter(x => x).length;
        } catch (err) { available = 0; }
        return { name: c.name, key: c.key, available };
      })
    );
    return result;
  } catch (err) {
    console.log("Error getCountries:", err);
    return [];
  }
}

// طلب رقم جديد
async function getNumber(countryKey, app) {
  try {
    const url = `${PROVIDER_URL}/GetNumber.php?key=${PROVIDER_KEY}&from_id=0&country=${countryKey}&app=${app}`;
    const res = await axios.get(url);
    return res.data.number || res.data; // حسب ما يرجعه المزود
  } catch (err) {
    console.log("Error getNumber:", err);
    return null;
  }
}

// طلب الكود/الرسالة
async function getSms(number) {
  try {
    const url = `${PROVIDER_URL}/GetSms.php?key=${PROVIDER_KEY}&from_id=0&number=${number}`;
    const res = await axios.get(url);
    return res.data.sms || res.data;
  } catch (err) {
    console.log("Error getSms:", err);
    return "لا توجد رسالة حتى الآن";
  }
}

module.exports = { getCountries, getNumber, getSms };

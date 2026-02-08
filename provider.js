const axios = require("axios");

const BASE_URL = process.env.PROVIDER_URL; // https://numbros.shop/jj/tele
const KEY = process.env.PROVIDER_KEY;

// جلب الدول المتاحة لأي تطبيق
async function getCountries(app, from_id) {
  try {
    // رابط الدول الرسمي
    const res = await axios.get(`${process.env.PROVIDER_URL.replace('/tele','')}/countries.json`);
    const countriesData = res.data;

    // بناء مصفوفة تحتوي اسم الدولة والكود وحالة الأرقام المتوفرة
    const countries = Object.keys(countriesData).map(key => ({
      key,
      name: countriesData[key],
      available: "متوفر" // مؤقت، لاحقًا يمكن التحديث بعد جلب الأرقام المتاحة
    }));

    return countries;
  } catch (err) {
    console.log("Error fetching countries:", err.message);
    return [];
  }
}

// طلب رقم جديد
async function getNumber(app, countryKey, from_id) {
  try {
    const url = `${BASE_URL}/GetNumber.php?key=${KEY}&from_id=${from_id}&country=${countryKey}&app=${app}`;
    const res = await axios.get(url);
    return res.data; // عادة يرجع الرقم مباشرة
  } catch (err) {
    console.log("Error fetching number:", err.message);
    return null;
  }
}

// استلام الرسائل للكود
async function getSms(number, from_id) {
  try {
    const url = `${BASE_URL}/GetSms.php?key=${KEY}&from_id=${from_id}&number=${number}`;
    const res = await axios.get(url);
    return res.data; // الرسالة النصية
  } catch (err) {
    console.log("Error fetching SMS:", err.message);
    return "لم يتم استلام الرسالة بعد";
  }
}

// معرفة الرصيد
async function getBalance(from_id) {
  try {
    const url = `${BASE_URL}/GetBalance.php?key=${KEY}&from_id=${from_id}`;
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.log("Error fetching balance:", err.message);
    return 0;
  }
}

module.exports = { getCountries, getNumber, getSms, getBalance };

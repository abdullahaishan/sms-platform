const axios = require("axios");

const BASE_URL = "https://numbros.shop/jj";
const KEY = process.env.PROVIDER_KEY;

// ------------------- GET COUNTRIES -------------------
async function getCountries(appCode) {
  try {
    const res = await axios.get(`${BASE_URL}/countries.json`);
    const countriesObj = res.data;

    // تحويل object إلى array
    const countriesList = Object.keys(countriesObj).map(key => ({
      key,
      name: countriesObj[key]
    }));

    // الآن نتحقق من توفر الأرقام لكل دولة (بالتطبيق)
    const availableCountries = [];

    for (let country of countriesList) {
      try {
        // جلب ملف الأرقام، نحاول حسب التطبيق
        const numbersUrl = `${BASE_URL}/numbers/${appCode}/${country.key}.txt`;
        const numbersRes = await axios.get(numbersUrl);

        // إذا كانت الاستجابة ليست خطأ وتحتوي على نص غير فارغ
        if (numbersRes.data && numbersRes.data.trim().length > 0) {
          // نحسب عدد الأرقام (كل سطر رقم)
          const count = numbersRes.data
            .trim()
            .split("\n")
            .filter(n => n.trim().length > 0).length;

          availableCountries.push({
            key: country.key,
            name: country.name,
            available: count
          });
        }
      } catch (err) {
        // لا نفعل شيء إذا لم يفتح الملف → لا توجد أرقام
      }
    }

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

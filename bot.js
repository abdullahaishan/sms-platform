const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db"); // قاعدة البيانات الجديدة
const provider = require("./provider"); // المزود القديم

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ------------------- HELPER FUNCTIONS -------------------
async function checkSubscriptions(chatId) {
  const { data: channels } = await supabase.from("channels").select("*");
  const notJoined = [];
  for (let channel of channels) {
    try {
      const member = await bot.getChatMember(channel.link, chatId);
      if (["left", "kicked"].includes(member.status)) {
        notJoined.push(channel);
      }
    } catch (err) {
      console.log("Error checking subscription:", err.message);
    }
  }
  return notJoined;
}

function generateKeyboard(options) {
  return {
    reply_markup: {
      inline_keyboard: options.map(opt => [{ text: opt.text, callback_data: opt.data }])
    }
  };
}

// ------------------- START COMMAND -------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await supabase.from("users").upsert({
    telegram_id: chatId,
    username: msg.from.username,
    balance: 0
  });

  const notJoined = await checkSubscriptions(chatId);

  if (notJoined.length > 0) {
    let text = `👋︙مرحباً بك ${msg.from.first_name}\n\n` +
               `☑️︙يجب عليك الإشتراك بالقنوات التالية لتتمكن من استعمال البوت:\n`;
    for (let ch of notJoined) text += `• ${ch.name}: ${ch.link}\n`;

    return bot.sendMessage(chatId, text, generateKeyboard([{ text: "تحقق من انضمامي ✅", data: "check_channels" }]));
  }

  sendMainMenu(chatId);
});

// ------------------- MAIN MENU -------------------
async function sendMainMenu(chatId) {
  const { data: user } = await supabase.from("users").select("*").eq("telegram_id", chatId).single();

  const text = `👋︙مرحباً بك في بوت خدمات مجانية | Free Number 📲\n\n` +
               `💰︙رصيدك : ${user?.balance || 0} ريال يمني\n` +
               `🎛︙رقم حسابك : ${chatId}\n\n` +
               `🤖︙دعم البوت : @abdullah_aishan`;

  const keyboard = [
    { text: "اختيار الرقم 📱", data: "choose_app" },
    { text: "قسم API 🔗", data: "api_section" },
    { text: "الدعم 🛠", data: "support" },
    { text: "القائمة الرئيسية 🏠", data: "main_menu" }
  ];

  bot.sendMessage(chatId, text, generateKeyboard(keyboard));
}

// ------------------- CALLBACK HANDLER -------------------
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id); // مهم جداً

  // ------------------- CHECK CHANNELS -------------------
  if (data === "check_channels") {
    const notJoined = await checkSubscriptions(chatId);
    if (notJoined.length > 0) {
      let text = `☑️︙لا زلت لم تنضم لهذه القنوات:\n`;
      for (let ch of notJoined) text += `• ${ch.name}: ${ch.link}\n`;
      return bot.sendMessage(chatId, text, generateKeyboard([{ text: "تحقق مرة اخرى ✅", data: "check_channels" }]));
    }
    return sendMainMenu(chatId);
  }

  // ------------------- MAIN MENU -------------------
  if (data === "main_menu") return sendMainMenu(chatId);

  // ------------------- CHOOSE APP -------------------
  if (data === "choose_app") {
    const text = `🤖︙اختر التطبيق:`;
    const keyboard = [
      { text: "واتساب 📱", data: "app_whatsapp" },
      { text: "تليجرام ✈️", data: "app_telegram" },
      { text: "فيسبوك 📘", data: "app_facebook" },
      { text: "العودة ↩️", data: "main_menu" }
    ];
    return bot.sendMessage(chatId, text, generateKeyboard(keyboard));
  }

  // ------------------- SELECT APP -------------------
  if (data.startsWith("app_")) {
    const app = data.split("_")[1]; // whatsapp / telegram / facebook
    let countries = [];
    try {
      countries = await provider.getCountries(app); // يجب أن تعيد [{key, name, available}]
    } catch (err) {
      console.log("Error fetching countries:", err.message);
      return bot.sendMessage(chatId, "❌ حدث خطأ عند جلب الدول.");
    }

    const text = `🌍︙اختر الدولة لطلب الرقم:`;
    const keyboard = countries.map(c => ({ text: `${c.name} (${c.available})`, data: `country_${app}_${c.key}` }));
    keyboard.push({ text: "العودة ↩️", data: "choose_app" });

    return bot.sendMessage(chatId, text, generateKeyboard(keyboard));
  }

  // ------------------- SELECT COUNTRY -------------------
  if (data.startsWith("country_")) {
    const parts = data.split("_");
    const app = parts[1];
    const countryKey = parts[2];

    let number;
    try {
      number = await provider.getNumber(countryKey, app);
    } catch (err) {
      console.log("Error fetching number:", err.message);
      return bot.sendMessage(chatId, "❌ حدث خطأ عند طلب الرقم.");
    }

    // حفظ الطلب بالقاعدة الجديدة (تاريخ فقط)
    const { data: user } = await supabase.from("users").select("*").eq("telegram_id", chatId).single();
    await supabase.from("orders").insert({
      user_id: user.id,
      number,
      country: countryKey,
      app_code: app,
      status: "waiting"
    });

    const text = `☑️︙تم شراء رقم جديد بنجاح\n\n` +
                 `🌐︙الدولة: ${countryKey}\n` +
                 `🕹︙التطبيق: ${app}\n` +
                 `☎️︙الرقم: ${number}\n` +
                 `💵︙السعر: 0 ريال يمني\n` +
                 `🎲︙قم بطلب الكود وانتظر دقيقتين ثم انقر على (طلب الكود)`;

    const keyboard = [
      { text: "تغيير الرقم 🔄", data: `country_${app}_${countryKey}` },
      { text: "طلب الكود 📨", data: `get_code_${number}` },
      { text: "العودة ↩️", data: "choose_app" },
      { text: "القائمة الرئيسية 🏠", data: "main_menu" }
    ];

    return bot.sendMessage(chatId, text, generateKeyboard(keyboard));
  }

  // ------------------- GET CODE -------------------
  if (data.startsWith("get_code_")) {
    const number = data.replace("get_code_", "");
    let sms;
    try {
      sms = await provider.getSms(number);
    } catch (err) {
      console.log("Error fetching SMS:", err.message);
      return bot.sendMessage(chatId, "❌ حدث خطأ عند جلب الرسالة.");
    }
    return bot.sendMessage(chatId, `✉️︙الرسالة:\n${sms}`);
  }

  // ------------------- SUPPORT -------------------
  if (data === "support") return bot.sendMessage(chatId, "للدعم: @abdullah_aishan");

  // ------------------- API SECTION -------------------
  if (data === "api_section") return bot.sendMessage(chatId, "قسم API سيتم تطويره لاحقًا.");

});

module.exports = bot;

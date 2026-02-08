const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db"); // اتصال Supabase
const provider = require("./provider"); // المزود القديم

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ------------------- HELPER FUNCTIONS -------------------
async function checkSubscriptions(chatId) {
  const { data: channels } = await supabase
    .from("channels")
    .select("*");

  const notJoined = [];
  for (let channel of channels) {
    try {
      const member = await bot.getChatMember(channel.link, chatId);
      if (["left", "kicked"].includes(member.status)) {
        notJoined.push(channel);
      }
    } catch (err) {
      console.log("Error checking subscription:", err);
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

// ------------------- START -------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await supabase.from("users").upsert({
    telegram_id: chatId,
    username: msg.from.username,
    balance: 0
  });

  const notJoined = await checkSubscriptions(chatId);
  if (notJoined.length > 0) {
    let text = `👋︙مرحباً بك ${msg.from.first_name}\n\n`;
    text += `☑️︙يجب عليك الإشتراك بالقنوات التالية:\n`;
    for (let ch of notJoined) text += `• ${ch.name}: ${ch.link}\n`;

    return bot.sendMessage(chatId, text, generateKeyboard([{ text: "تحقق من انضمامي ✅", data: "check_channels" }]));
  }

  sendMainMenu(chatId);
});

// ------------------- MAIN MENU -------------------
async function sendMainMenu(chatId) {
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", chatId)
    .single();

  const text = `👋︙مرحباً بك في بوت الأرقام المجانية 📲\n\n` +
    `💰︙رصيدك : ${user.balance || 0} ريال يمني\n` +
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

// ------------------- CALLBACK -------------------
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "check_channels") {
    const notJoined = await checkSubscriptions(chatId);
    if (notJoined.length > 0) {
      let text = `☑️︙لا زلت لم تنضم لهذه القنوات:\n`;
      for (let ch of notJoined) text += `• ${ch.name}: ${ch.link}\n`;
      return bot.sendMessage(chatId, text, generateKeyboard([{ text: "تحقق مرة اخرى ✅", data: "check_channels" }]));
    }
    return sendMainMenu(chatId);
  }

  if (data === "main_menu") return sendMainMenu(chatId);

  // ------------------- اختيار التطبيق -------------------
  if (data === "choose_app") {
    const apps = await provider.getAppMap();
    const keyboard = Object.entries(apps).map(([key, name]) => ({ text: name, data: `app_${key}` }));
    keyboard.push({ text: "العودة ↩️", data: "main_menu" });
    return bot.sendMessage(chatId, "🤖︙اختر التطبيق:", generateKeyboard(keyboard));
  }

  // ------------------- اختيار التطبيق المحدد -------------------
  if (data.startsWith("app_")) {
    const app = data.split("_")[1];
    const countries = await provider.getCountries();
    const prices = await provider.getPrices();

    const keyboard = countries.map(c => {
      const price = prices[c.key]?.[app] || 0;
      return { text: `${c.name} (${c.available} متوفر) - ${price} ريال`, data: `country_${app}_${c.key}` };
    });

    keyboard.push({ text: "العودة ↩️", data: "choose_app" });
    return bot.sendMessage(chatId, "🌍︙اختر الدولة لطلب الرقم:", generateKeyboard(keyboard));
  }

  // ------------------- اختيار الدولة -------------------
  if (data.startsWith("country_")) {
    const [_, app, country] = data.split("_");
    const from_id = chatId; // نستخدم Telegram ID كمفتاح

    const { raw, number } = await provider.getNumber(from_id, country, app);

    const prices = await provider.getPrices();
    const price = prices[country]?.[app] || 0;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", chatId)
      .single();

    // حفظ الطلب
    await supabase.from("orders").insert({
      user_id: user.id,
      number,
      country,
      app_code: app,
      status: "waiting",
      created_at: new Date()
    });

    const text = `☑️︙تم شراء رقم جديد بنجاح\n\n` +
      `🌐︙الدولة: ${country}\n` +
      `🕹︙التطبيق: ${app}\n` +
      `☎️︙الرقم: ${number}\n` +
      `💵︙السعر: ${price} ريال يمني\n\n` +
      `🎲︙يمكنك تغيير الرقم أو طلب الكود عند وصول الرسالة`;

    const keyboard = [
      { text: "تغيير الرقم 🔄", data: `country_${app}_${country}` },
      { text: "طلب الكود 📨", data: `get_code_${number}` },
      { text: "العودة ↩️", data: "choose_app" },
      { text: "القائمة الرئيسية 🏠", data: "main_menu" }
    ];

    return bot.sendMessage(chatId, text, generateKeyboard(keyboard));
  }

  // ------------------- طلب الكود -------------------
  if (data.startsWith("get_code_")) {
    const number = data.replace("get_code_", "");
    const sms = await provider.getSms(chatId, number);
    return bot.sendMessage(chatId, `✉️︙الرسالة:\n${sms}`);
  }

  // ------------------- الدعم -------------------
  if (data === "support") return bot.sendMessage(chatId, "للدعم: @abdullah_aishan");

  // ------------------- API -------------------
  if (data === "api_section") return bot.sendMessage(chatId, "قسم API سيتم تطويره لاحقًا.");

  bot.answerCallbackQuery(query.id);
});

module.exports = bot;

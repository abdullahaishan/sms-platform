// استدعاء المكتبات
const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db");
const provider = require("./provider");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// ------------------- HELPER -------------------
async function checkSubscriptions(chatId) {
  const { data: channels } = await supabase.from("channels").select("*");
  const notJoined = [];
  for (let channel of channels) {
    try {
      const member = await bot.getChatMember(channel.link, chatId);
      if (["left", "kicked"].includes(member.status)) notJoined.push(channel);
    } catch (err) {}
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
  await supabase.from("users").upsert({ telegram_id: chatId, username: msg.from.username, balance: 0 });
  const notJoined = await checkSubscriptions(chatId);
  if (notJoined.length > 0) {
    let text = `👋︙مرحباً بك ${msg.from.first_name}\n\n☑️︙يجب عليك الإشتراك بالقنوات:\n`;
    for (let ch of notJoined) text += `• ${ch.name}: ${ch.link}\n`;
    return bot.sendMessage(chatId, text, generateKeyboard([{ text: "تحقق من انضمامي ✅", data: "check_channels" }]));
  }
  sendMainMenu(chatId);
});

// ------------------- MAIN MENU -------------------
async function sendMainMenu(chatId) {
  const { data: user } = await supabase.from("users").select("*").eq("telegram_id", chatId).single();
  const text = `👋︙مرحباً بك في بوت خدمات مجانية | Free Number 📲\n\n💰︙رصيدك : ${user.balance || 0} ريال يمني\n🎛︙رقم حسابك : ${chatId}\n\n🤖︙دعم البوت : @abdullah_aishan`;
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

  if (data.startsWith("app_")) {
    const app = data.split("_")[1];
    const countries = await provider.getCountries(app);
    const text = `🌍︙اختر الدولة لطلب الرقم:`;
    const keyboard = countries.map(c => ({ text: `${c.name} (${c.available})`, data: `country_${app}_${c.key}` }));
    keyboard.push({ text: "العودة ↩️", data: "choose_app" });
    return bot.sendMessage(chatId, text, generateKeyboard(keyboard));
  }

  if (data.startsWith("country_")) {
    const parts = data.split("_");
    const app = parts[1];
    const countryKey = parts[2];
    const number = await provider.getNumber(countryKey, app);

    const { data: user } = await supabase.from("users").select("*").eq("telegram_id", chatId).single();
    await supabase.from("orders").insert({ user_id: user.id, number, country: countryKey, app_code: app, status: "waiting" });

    const text = `☑️︙تم شراء رقم جديد بنجاح\n\n🌐︙الدولة: ${countryKey}\n🕹︙التطبيق: ${app}\n☎️︙الرقم: ${number}\n💵︙السعر: 0 ريال يمني\n🎲︙قم بطلب الكود وانتظر 2 دقائق وانقر على (طلب الكود) استمتع بالبوت`;
    const keyboard = [
      { text: "تغيير الرقم 🔄", data: `country_${app}_${countryKey}` },
      { text: "طلب الكود 📨", data: `get_code_${number}` },
      { text: "العودة ↩️", data: "choose_app" },
      { text: "القائمة الرئيسية 🏠", data: "main_menu" }
    ];
    return bot.sendMessage(chatId, text, generateKeyboard(keyboard));
  }

  if (data.startsWith("get_code_")) {
    const number = data.replace("get_code_", "");
    const sms = await provider.getSms(number);
    return bot.sendMessage(chatId, `✉️︙الرسالة:\n${sms}`);
  }

  if (data === "support") return bot.sendMessage(chatId, "للدعم: @abdullah_aishan");
  if (data === "api_section") return bot.sendMessage(chatId, "قسم API سيتم تطويره لاحقًا.");

  bot.answerCallbackQuery(query.id);
});

// ------------------- NOTIFICATION LOOP -------------------
async function notifyNewNumbers() {
  const apps = ["whatsapp", "telegram", "facebook"];
  for (let app of apps) {
    const countries = await provider.getCountries(app);
    for (let c of countries) {
      if (c.available > 0) {
        const { data: users } = await supabase.from("users").select("telegram_id");
        for (let user of users) {
          bot.sendMessage(user.telegram_id, `📢︙تمت إضافة أرقام جديدة لتطبيق ${app} في دولة ${c.name}.\nيمكنك طلب الرقم الآن!`);
        }
      }
    }
  }
  setTimeout(notifyNewNumbers, 5 * 60 * 1000); // كل 5 دقائق
}
notifyNewNumbers();

module.exports = bot;
  if (data === "balance") {
    const { data: user } = await supabase
      .from("users")
      .select("balance")
      .eq("telegram_id", chatId)
      .single();

    bot.sendMessage(chatId, `رصيدك الحالي: ${user?.balance || 0}`);
  }

  if (data === "get_number") {
    bot.sendMessage(chatId, "أرسل الدولة والتطبيق بهذا الشكل:\n`COUNTRY,APP`", { parse_mode: "Markdown" });
  }

  if (data === "get_sms") {
    bot.sendMessage(chatId, "أرسل الرقم للحصول على الرسالة بهذا الشكل:\n`/sms <NUMBER>`", { parse_mode: "Markdown" });
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// أوامر نصية تقليدية
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;

  const { data: user } = await supabase
    .from("users")
    .select("balance")
    .eq("telegram_id", chatId)
    .single();

  bot.sendMessage(chatId, `رصيدك الحالي: ${user?.balance || 0}`);
});

bot.onText(/\/number (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const [country, app] = match[1].split(",");

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", chatId)
    .single();

  if (!user || user.balance < 0) {
    return bot.sendMessage(chatId, "لا يوجد لديك رصيد.");
  }

  const response = await provider.getNumber(country, app);

  if (!response || response.includes("NO")) {
    return bot.sendMessage(chatId, "لا يوجد أرقام حالياً.");
  }

  await supabase.from("orders").insert({
    user_id: user.id,
    number: response,
    country,
    app_code: app,
    status: "waiting"
  });

  bot.sendMessage(chatId, `رقمك:\n${response}\n\nاستخدم /sms الرقم`);
});

bot.onText(/\/sms (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const number = match[1];

  const sms = await provider.getSms(number);

  bot.sendMessage(chatId, `الرسالة:\n${sms}`);
});

module.exports = bot;

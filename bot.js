const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db"); // ملف اتصال Supabase
const provider = require("./provider"); // ملف للتعامل مع المزود القديم

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// رسالة الترحيب مع أزرار
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await supabase.from("users").upsert({
    telegram_id: chatId,
    username: msg.from.username,
    balance: 0
  });

  const welcomeText = "مرحباً بك في بوت الأرقام 🔥\nاختر ما تريد من الأزرار:";

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "رصيدي 💰", callback_data: "balance" }],
        [{ text: "طلب رقم 📱", callback_data: "get_number" }],
        [{ text: "جلب الرسالة ✉️", callback_data: "get_sms" }]
      ]
    }
  };

  bot.sendMessage(chatId, welcomeText, keyboard);
});

// التعامل مع الضغط على الأزرار
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

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

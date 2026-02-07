const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db");
const provider = require("./provider");

// إيقاف polling لأنه Webhook
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await supabase.from("users").upsert({
    telegram_id: chatId,
    username: msg.from.username,
    balance: 0
  });

  bot.sendMessage(chatId, "مرحباً بك في بوت الأرقام 🔥");
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;

  const { data } = await supabase
    .from("users")
    .select("balance")
    .eq("telegram_id", chatId)
    .single();

  bot.sendMessage(chatId, `رصيدك الحالي: ${data?.balance || 0}`);
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

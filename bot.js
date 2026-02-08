require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const provider = require("./provider");
const supabase = require("./db");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

function createKeyboard(buttons) {
  return {
    reply_markup: { inline_keyboard: buttons.map(b => [b]) }
  };
}

// رسالة ترحيب أولية
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || "المستخدم";

  // حفظ المستخدم في Supabase إذا لم يكن موجود
  await supabase.from("users")
    .upsert({ telegram_id: chatId, username: msg.from.username });

  const welcomeText = `
👋 أهلاً ${firstName} في بوت الأرقام 📲

🤖 *Free Number Bot*
أنا بوت يوفر لك:
📍 أرقام واتساب / تلجرام / فيسبوك  
📥 طلب كود مباشرة  
🔄 تغيير الرقم بسهولة  
📊 عرض الدول المتاحة تلقائيًا

🎯 ابدأ الآن عبر الأزرار أدناه!
`;

  const keyboard = [
    { text: "📱 شراء رقم", callback_data: "choose_app" },
    { text: "💰 رصيدي", callback_data: "check_balance" },
    { text: "📋 طلباتي", callback_data: "my_orders" },
    { text: "🆘 مساعدة", callback_data: "help" }
  ];

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: "Markdown",
    ...createKeyboard(keyboard)
  });
});

// التعامل مع أزرار المستخدم
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  // اختيار التطبيق
  if (data === "choose_app") {
    return bot.sendMessage(chatId, "🤖 اختر التطبيق:", createKeyboard([
      { text: "📱 واتساب", callback_data: "app_wa" },
      { text: "✈️ تلجرام", callback_data: "app_tg" },
      { text: "📘 فيسبوك", callback_data: "app_fb" },
      { text: "🏠 الرئيسية", callback_data: "/start" }
    ]));
  }

  // عرض الرصيد من مزود الأرقام
  if (data === "check_balance") {
    const balance = await provider.getBalance(chatId);
    return bot.sendMessage(chatId, `💰 رصيدك في المزود القديم:\n${balance}`);
  }

  // قسم "طلباتي" من Supabase
  if (data === "my_orders") {
    const { data: user } = await supabase
      .from("users").select("id").eq("telegram_id", chatId).single();

    const { data: orders } = await supabase
      .from("orders").select("*").eq("user_id", user?.id).order("created_at", { ascending: false });

    if (!orders || orders.length === 0) {
      return bot.sendMessage(chatId, "📭 ليس لديك طلبات سابقة.");
    }

    let text = "*📋 طلباتك السابقة:*\n\n";
    orders.forEach((o, i) => {
      text += `${i + 1}. ${o.app_code} - ${o.number}\n`;
    });

    return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }

  // طلب المساعدة
  if (data === "help") {
    return bot.sendMessage(chatId, "📌 يمكنك طلب رقم بعد اختيار التطبيق ثم الدولة.");
  }

  // عند اختيار تطبيق معين
  if (data.startsWith("app_")) {
    const app = data.split("_")[1];
    const countries = await provider.getCountries(app);

    if (!countries.length) {
      return bot.sendMessage(chatId, "⚠️ لا تتوفر أرقام الآن.");
    }

    const items = countries.map(c => ({
      text: `${c.name} (${c.available})`,
      callback_data: `country_${app}_${c.key}`
    }));

    items.push({ text: "🔙 اختر تطبيق آخر", callback_data: "choose_app" });
    return bot.sendMessage(chatId, "🌍 اختر الدولة:", createKeyboard(items));
  }

  // عند اختيار دولة
  if (data.startsWith("country_")) {
    const parts = data.split("_");
    const app = parts[1];
    const country = parts[2];

    const number = await provider.getNumber(app, country, chatId);
    if (!number) {
      return bot.sendMessage(chatId, "⚠️ حدث خطأ في جلب الرقم.");
    }

    // إدراج طلب في Supabase
    const { data: user } = await supabase
      .from("users").select("id").eq("telegram_id", chatId).single();

    await supabase.from("orders").insert({
      user_id: user.id,
      number,
      country,
      app_code: app,
      status: "waiting"
    });

    const text = `📍 الدولة: ${country}\n📱 التطبيق: ${app}\n☎️ رقمك: ${number}`;

    const keyboard = [
      { text: "🔄 تغيير الرقم", callback_data: `change_${app}_${country}` },
      { text: "📨 طلب الكود", callback_data: `sms_${number}` },
      { text: "🏠 الرئيسية", callback_data: "/start" }
    ];
    return bot.sendMessage(chatId, text, createKeyboard(keyboard));
  }

  // تغيير الرقم
  if (data.startsWith("change_")) {
    const [_, app, country] = data.split("_");
    const newNumber = await provider.getNumber(app, country, chatId);
    return bot.sendMessage(chatId, `📱 رقم جديد:\n${newNumber}`);
  }

  // طلب الكود
  if (data.startsWith("sms_")) {
    const number = data.split("_")[1];
    const sms = await provider.getSms(number, chatId);
    return bot.sendMessage(chatId, `✉️ الرسالة:\n${sms}`);
  }

});

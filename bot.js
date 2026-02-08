require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db");
const provider = require("./provider");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// دالة لإنشاء كيبورد إنلاين
function createKeyboard(buttons) {
  return {
    reply_markup: {
      inline_keyboard: buttons.map(btn => [btn])
    }
  };
}

// رسالة البداية
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  
  // حفظ المستخدم
  await supabase.from("users").upsert({
    telegram_id: chatId,
    username: msg.from.username
  });

  const welcomeText = `👋 مرحباً بك في بوت الأرقام 📱\n\nاختر (شراء رقم) من القائمة.`;
  const keyboard = [
    { text: "📱 شراء رقم", callback_data: "choose_app" },
    { text: "💰 رصيدي", callback_data: "check_balance" }
  ];
  bot.sendMessage(chatId, welcomeText, createKeyboard(keyboard));
});

// التعامل مع الأزرار
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const msgId = query.message.message_id;

  await bot.answerCallbackQuery(query.id);

  // اختيار التطبيق
  if (data === "choose_app") {
    const text = "🤖 اختر التطبيق:";
    const keyboard = [
      { text: "📱 واتساب", callback_data: "app_wa" },
      { text: "✈️ تليجرام", callback_data: "app_tg" },
      { text: "📘 فيسبوك", callback_data: "app_fb" },
      { text: "🏠 الرئيسية", callback_data: "main" }
    ];
    return bot.sendMessage(chatId, text, createKeyboard(keyboard));
  }

  // تأكيد الرصيد
  if (data === "check_balance") {
    const balance = await provider.getBalance(chatId);
    return bot.sendMessage(chatId, `💰 رصيدك في المزود القديم:\n${balance}`, { reply_markup: { remove_keyboard: true }});
  }

  // اختيار الدولة بعد التطبيق
  if (data.startsWith("app_")) {
    const app = data.split("_")[1]; // wa / tg / fb
    const countries = await provider.getCountries(app);

    if (!countries || countries.length === 0) {
      return bot.sendMessage(chatId, "⚠️ لا توجد أرقام متاحة حالياً.", createKeyboard([{ text: "🔙 رجوع", callback_data: "choose_app" }]));
    }

    const keyboard = countries.map(c => ({
      text: `${c.name} (${c.available})`,
      callback_data: `country_${app}_${c.key}`
    }));
    keyboard.push({ text: "🔙 رجوع", callback_data: "choose_app" });

    return bot.sendMessage(chatId, `🌍 اختر الدولة:`, createKeyboard(keyboard));
  }

  // تم اختيار دولة
  if (data.startsWith("country_")) {
    const parts = data.split("_");
    const app = parts[1];
    const countryKey = parts[2];

    const number = await provider.getNumber(app, countryKey, chatId);
    if (!number) {
      return bot.sendMessage(chatId, "⚠️ لا يمكن طلب رقم الآن. حاول لاحقاً.");
    }

    const text = `📍 الدولة: ${countryKey}\n` +
                 `📱 التطبيق: ${app}\n` +
                 `☎️ رقمك: ${number}`;

    const keyboard = [
      { text: "🔄 تغيير الرقم", callback_data: `change_${app}_${countryKey}` },
      { text: "📨 طلب الكود", callback_data: `sms_${number}` },
      { text: "🔙 اختر دولة", callback_data: `app_${app}` },
      { text: "🏠 الرئيسية", callback_data: "choose_app" }
    ];

    return bot.sendMessage(chatId, text, createKeyboard(keyboard));
  }

  // تغيير الرقم بنفس الدولة
  if (data.startsWith("change_")) {
    const parts = data.split("_");
    const app = parts[1];
    const countryKey = parts[2];

    const newNumber = await provider.getNumber(app, countryKey, chatId);
    const text = `📱 رقم جديد:\n${newNumber}`;

    const keyboard = [
      { text: "🔄 تغيير آخر", callback_data: `change_${app}_${countryKey}` },
      { text: "📨 طلب الكود", callback_data: `sms_${newNumber}` },
      { text: "🔙 اختر دولة", callback_data: `app_${app}` },
      { text: "🏠 الرئيسية", callback_data: "choose_app" }
    ];

    return bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      ...createKeyboard(keyboard)
    });
  }

  // طلب الكود
  if (data.startsWith("sms_")) {
    const number = data.split("_")[1];
    const sms = await provider.getSms(number, chatId);
    return bot.sendMessage(chatId, `✉️ الرسالة:\n${sms}`);
  }

  // العودة إلى الرئيسية
  if (data === "main") {
    return sendMainMenu(chatId);
  }
});

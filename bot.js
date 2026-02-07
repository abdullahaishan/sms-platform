const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db");
const provider = require("./provider");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

/* ================= HELPER FUNCTIONS ================= */

async function checkSubscriptions(chatId) {
  const { data: channels } = await supabase.from("channels").select("*");
  if (!channels) return [];

  const notJoined = [];

  for (let channel of channels) {
    try {
      const member = await bot.getChatMember(channel.link, chatId);
      if (["left", "kicked"].includes(member.status)) {
        notJoined.push(channel);
      }
    } catch (err) {
      console.log("Subscription check error:", err.message);
    }
  }

  return notJoined;
}

function generateKeyboard(buttons) {
  return {
    reply_markup: {
      inline_keyboard: buttons.map(btn => [
        { text: btn.text, callback_data: btn.data }
      ])
    }
  };
}

/* ================= START COMMAND ================= */

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await supabase.from("users").upsert({
    telegram_id: chatId,
    username: msg.from.username,
    balance: 0
  });

  const notJoined = await checkSubscriptions(chatId);

  if (notJoined.length > 0) {
    let text = `👋︙مرحباً بك ${msg.from.first_name}\n\n☑️︙يجب عليك الإشتراك بالقنوات التالية:\n`;

    for (let ch of notJoined) {
      text += `• ${ch.name}: ${ch.link}\n`;
    }

    return bot.sendMessage(
      chatId,
      text,
      generateKeyboard([
        { text: "تحقق من انضمامي ✅", data: "check_channels" }
      ])
    );
  }

  return sendMainMenu(chatId);
});

/* ================= MAIN MENU ================= */

async function sendMainMenu(chatId) {
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", chatId)
    .single();

  const text = `👋︙مرحباً بك في بوت خدمات مجانية | Free Number 📲

💰︙رصيدك : ${user?.balance || 0} ريال يمني
🎛︙رقم حسابك : ${chatId}

🤖︙دعم البوت : @abdullah_aishan`;

  return bot.sendMessage(
    chatId,
    text,
    generateKeyboard([
      { text: "اختيار الرقم 📱", data: "choose_app" },
      { text: "قسم API 🔗", data: "api_section" },
      { text: "الدعم 🛠", data: "support" }
    ])
  );
}

/* ================= CALLBACK HANDLER ================= */

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    // تحقق الاشتراك
    if (data === "check_channels") {
      const notJoined = await checkSubscriptions(chatId);

      if (notJoined.length > 0) {
        let text = `☑️︙لا زلت لم تنضم لهذه القنوات:\n`;
        for (let ch of notJoined) {
          text += `• ${ch.name}: ${ch.link}\n`;
        }

        return bot.sendMessage(
          chatId,
          text,
          generateKeyboard([
            { text: "تحقق مرة اخرى ✅", data: "check_channels" }
          ])
        );
      }

      return sendMainMenu(chatId);
    }

    // اختيار التطبيق
    if (data === "choose_app") {
      return bot.sendMessage(
        chatId,
        "🤖︙اختر التطبيق:",
        generateKeyboard([
          { text: "واتساب 📱", data: "app_whatsapp" },
          { text: "تليجرام ✈️", data: "app_telegram" },
          { text: "فيسبوك 📘", data: "app_facebook" },
          { text: "العودة ↩️", data: "main_menu" }
        ])
      );
    }

    // رجوع للقائمة
    if (data === "main_menu") {
      return sendMainMenu(chatId);
    }

    // اختيار دولة
    if (data.startsWith("app_")) {
      const app = data.split("_")[1];

      const countries = await provider.getCountries(app);

      const keyboard = countries.map(c => ({
        text: `${c.name} (${c.available})`,
        data: `country_${app}_${c.key}`
      }));

      keyboard.push({ text: "العودة ↩️", data: "choose_app" });

      return bot.sendMessage(
        chatId,
        "🌍︙اختر الدولة:",
        generateKeyboard(keyboard)
      );
    }

    // شراء رقم
    if (data.startsWith("country_")) {
      const parts = data.split("_");
      const app = parts[1];
      const countryKey = parts[2];

      const number = await provider.getNumber(countryKey, app);

      if (!number) {
        return bot.sendMessage(chatId, "❌ لا يوجد أرقام حالياً.");
      }

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", chatId)
        .single();

      await supabase.from("orders").insert({
        user_id: user.id,
        number,
        country: countryKey,
        app_code: app,
        status: "waiting"
      });

      return bot.sendMessage(
        chatId,
        `☑️︙تم شراء رقم جديد بنجاح

🌐︙الدولة: ${countryKey}
🕹︙التطبيق: ${app}
☎️︙الرقم: ${number}
💵︙السعر: 0 ريال يمني

🎲︙اضغط (طلب الكود) بعد دقيقتين`,
        generateKeyboard([
          { text: "طلب الكود 📨", data: `get_code_${number}` },
          { text: "العودة ↩️", data: "choose_app" }
        ])
      );
    }

    // طلب كود
    if (data.startsWith("get_code_")) {
      const number = data.replace("get_code_", "");
      const sms = await provider.getSms(number);

      return bot.sendMessage(chatId, `✉️︙الرسالة:\n${sms || "لا يوجد كود بعد"}`);
    }

    if (data === "support") {
      return bot.sendMessage(chatId, "للدعم: @abdullah_aishan");
    }

    if (data === "api_section") {
      return bot.sendMessage(chatId, "🔌 قسم API سيتم تفعيله قريباً.");
    }

  } catch (err) {
    console.error("Callback Error:", err);
    bot.sendMessage(chatId, "⚠ حدث خطأ غير متوقع.");
  }

  bot.answerCallbackQuery(query.id);
});

/* ================= NOTIFICATION LOOP ================= */

async function notifyNewNumbers() {
  try {
    const apps = ["whatsapp", "telegram", "facebook"];

    for (let app of apps) {
      const countries = await provider.getCountries(app);

      for (let c of countries) {
        if (c.available > 0) {
          const { data: users } = await supabase
            .from("users")
            .select("telegram_id");

          for (let user of users) {
            bot.sendMessage(
              user.telegram_id,
              `📢 تمت إضافة أرقام جديدة لـ ${app} في ${c.name}`
            );
          }
        }
      }
    }
  } catch (err) {
    console.log("Notification error:", err.message);
  }

  setTimeout(notifyNewNumbers, 5 * 60 * 1000);
}

notifyNewNumbers();

module.exports = bot;

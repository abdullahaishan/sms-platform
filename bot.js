module.exports = function (bot) {

  // عند /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, "مرحبا بك في البوت 🤖", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 طلب رقم", callback_data: "request_number" }],
          [{ text: "💰 الأرقام المدفوعة", callback_data: "paid_numbers" }]
        ]
      }
    });
  });

  // الأزرار
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === "request_number") {
      bot.sendMessage(chatId, "جاري تجهيز رقم لك...");
    }

    if (data === "paid_numbers") {
      bot.sendMessage(chatId, "لا توجد أرقام مدفوعة حالياً.");
    }

    bot.answerCallbackQuery(query.id);
  });

};    // رجوع للقائمة
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

const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db");
const provider = require("./provider");

module.exports = (bot) => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    await supabase.from("users").upsert({
      telegram_id: chatId,
      username: msg.from.username,
      balance: 0
    });

    bot.sendMessage(chatId, "مرحباً بك في بوت الأرقام 🔥\n\nاستخدم /balance لمعرفة رصيدك\nاستخدم /number country,app لشراء رقم");
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

    if (!country || !app) {
      return bot.sendMessage(chatId, "استخدم: /number country,app\nمثال: /number 6,whatsapp");
    }

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", chatId)
      .single();

    if (!user || user.balance < 0) {
      return bot.sendMessage(chatId, "لا يوجد لديك رصيد.");
    }

    bot.sendMessage(chatId, "⏳ جاري البحث عن رقم...");

    try {
      const response = await provider.getNumber(country.trim(), app.trim());

      if (!response || response.includes("NO")) {
        return bot.sendMessage(chatId, "لا يوجد أرقام حالياً.");
      }

      await supabase.from("orders").insert({
        user_id: user.id,
        number: response,
        country: country.trim(),
        app_code: app.trim(),
        status: "waiting"
      });

      bot.sendMessage(
        chatId, 
        `✅ تم شراء رقم بنجاح\n\n📱 الرقم: ${response}\n🌍 الدولة: ${country}\n📲 التطبيق: ${app}\n\nاستخدم:\n/sms ${response}`
      );
    } catch (error) {
      console.error("Error getting number:", error);
      bot.sendMessage(chatId, "حدث خطأ في جلب الرقم. حاول مرة أخرى.");
    }
  });

  bot.onText(/\/sms (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const number = match[1];

    if (!number) {
      return bot.sendMessage(chatId, "استخدم: /sms الرقم\nمثال: /sms 123456789");
    }

    bot.sendMessage(chatId, "⏳ جاري طلب الرسالة...");

    try {
      const sms = await provider.getSms(number.trim());

      if (!sms || sms.includes("NO")) {
        return bot.sendMessage(chatId, "لم يتم استلام أي رسالة بعد.");
      }

      bot.sendMessage(chatId, `📨 الرسالة المستلمة:\n\n${sms}`);
    } catch (error) {
      console.error("Error getting SMS:", error);
      bot.sendMessage(chatId, "حدث خطأ في جلب الرسالة. حاول مرة أخرى.");
    }
  });

  // أمر مساعدة
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
    📱 *أوامر البوت*

    /start - بدء البوت
    /balance - معرفة الرصيد
    /number country,app - شراء رقم
    /sms الرقم - طلب الرسالة
    /help - المساعدة

    *أمثلة:*
    /number 6,whatsapp
    /sms 123456789

    *الدعم:* @abdullah_aishan
    `;

    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  });

  // أمر التحقق من المخزون
  bot.onText(/\/stock/, async (msg) => {
    const chatId = msg.chat.id;
    
    // إضافة طلب لجلب الأسعار من API
    const axios = require('axios');
    
    try {
      const res = await axios.get("https://numbros.shop/jj/prices.json");
      let stockMessage = "📊 *المخزون الحالي:*\n\n";
      
      for (const country in res.data) {
        const count = res.data[country].count || 0;
        stockMessage += `🌍 ${country}: ${count} رقم\n`;
      }
      
      bot.sendMessage(chatId, stockMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      bot.sendMessage(chatId, "❌ حدث خطأ في جلب المخزون");
    }
  });

  console.log("🤖 Bot is ready!");
};

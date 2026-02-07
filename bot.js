const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db");
const provider = require("./provider");

// التحقق من وجود التوكن
if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is not defined in environment variables");
  process.exit(1);
}

// إنشاء البوت مع polling معطل (سنستخدم webhook)
const bot = new TelegramBot(process.env.BOT_TOKEN, { 
  polling: false,
  request: {
    timeout: 10000,
    agentOptions: {
      keepAlive: true
    }
  }
});

/* ==================== متغيرات المساعدة ==================== */
const ADMIN_ID = process.env.ADMIN_ID || null;
const CHANNELS_CHECK_ENABLED = process.env.CHECK_CHANNELS === 'true' || false;

/* ==================== دوال المساعدة ==================== */

/**
 * التحقق من اشتراك المستخدم في القنوات
 */
async function checkSubscriptions(chatId) {
  if (!CHANNELS_CHECK_ENABLED) {
    return []; // إرجاع مصفوفة فارغة إذا كان التحقق معطلاً
  }

  try {
    const { data: channels, error } = await supabase
      .from("channels")
      .select("*")
      .order('id', { ascending: true });

    if (error) {
      console.error("Database error in checkSubscriptions:", error);
      return [];
    }

    if (!channels || channels.length === 0) {
      return []; // لا توجد قنوات للتحقق
    }

    const notJoined = [];

    for (let channel of channels) {
      try {
        const member = await bot.getChatMember(channel.link, chatId);
        if (["left", "kicked"].includes(member.status)) {
          notJoined.push(channel);
        }
      } catch (err) {
        console.log(`Subscription check error for channel ${channel.name}:`, err.message);
        // لا نضيف القناة إلى القائمة إذا كان هناك خطأ في التحقق
      }
    }

    return notJoined;
  } catch (error) {
    console.error("Error in checkSubscriptions:", error);
    return [];
  }
}

/**
 * إنشاء كيبورد إنلاين
 */
function generateKeyboard(buttons, columns = 1) {
  const inlineKeyboard = [];
  let row = [];

  buttons.forEach((btn, index) => {
    row.push({
      text: btn.text,
      callback_data: btn.data
    });

    if ((index + 1) % columns === 0 || index === buttons.length - 1) {
      inlineKeyboard.push(row);
      row = [];
    }
  });

  return {
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  };
}

/**
 * إرسال القائمة الرئيسية
 */
async function sendMainMenu(chatId, firstName = "المستخدم") {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", chatId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = لا يوجد بيانات
      console.error("Database error in sendMainMenu:", error);
    }

    const balance = user?.balance || 0;
    const text = `👋︙مرحباً بك ${firstName} في بوت خدمات مجانية | Free Number 📲

💰︙رصيدك : ${balance} ريال يمني
🎛︙رقم حسابك : ${chatId}

🤖︙دعم البوت : @abdullah_aishan`;

    const keyboard = [
      { text: "اختيار الرقم 📱", data: "choose_app" },
      { text: "قسم API 🔗", data: "api_section" },
      { text: "الدعم 🛠", data: "support" }
    ];

    // إضافة زر الإحصائيات للإدمن فقط
    if (ADMIN_ID && chatId.toString() === ADMIN_ID.toString()) {
      keyboard.push({ text: "📊 الإحصائيات (ادمن)", data: "admin_stats" });
    }

    return bot.sendMessage(chatId, text, generateKeyboard(keyboard, 2));
  } catch (error) {
    console.error("Error in sendMainMenu:", error);
    return bot.sendMessage(chatId, "⚠ حدث خطأ في تحميل القائمة الرئيسية.");
  }
}

/**
 * التحقق من الأرصدة قبل الشراء
 */
async function checkBalance(chatId, price) {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("balance")
      .eq("telegram_id", chatId)
      .single();

    if (!user) return false;
    
    return user.balance >= price;
  } catch (error) {
    console.error("Error in checkBalance:", error);
    return false;
  }
}

/* ==================== معالجة الأوامر ==================== */

// أمر /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || "المستخدم";

  console.log(`📥 User ${chatId} (${msg.from?.username || 'no-username'}) started the bot`);

  try {
    // حفظ المستخدم في قاعدة البيانات
    const { error } = await supabase.from("users").upsert({
      telegram_id: chatId,
      username: msg.from.username,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
      balance: 0,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error("Database error in /start:", error);
    }

    // التحقق من الاشتراكات
    const notJoined = await checkSubscriptions(chatId);

    if (notJoined.length > 0) {
      let text = `👋︙مرحباً بك ${firstName}\n\n`;
      text += `☑️︙يجب عليك الإشتراك بالقنوات التالية:\n\n`;

      for (let ch of notJoined) {
        text += `📢 ${ch.name}\n`;
        text += `🔗 ${ch.link}\n\n`;
      }

      text += `بعد الانضمام، اضغط على الزر أدناه للتحقق`;

      return bot.sendMessage(
        chatId,
        text,
        generateKeyboard([
          { text: "✅ تحقق من انضمامي", data: "check_channels" },
          { text: "🔄 تحديث القنوات", data: "refresh_channels" }
        ])
      );
    }

    return sendMainMenu(chatId, firstName);
  } catch (error) {
    console.error("Error in /start command:", error);
    return bot.sendMessage(chatId, "⚠ حدث خطأ أثناء تحميل البوت. حاول مرة أخرى.");
  }
});

// أمر /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `❓ *مساعدة* ❓

*الأوامر المتاحة:*
/start - بدء استخدام البوت
/help - عرض هذه الرسالة
/balance - عرض رصيدك
/menu - عرض القائمة الرئيسية

*ميزات البوت:*
• شراء أرقام وهمية للتطبيقات
• دعم واتساب، تليجرام، فيسبوك
• متابعة الأرقام المتاحة
• إشعارات بالأرقام الجديدة

*الدعم:* @abdullah_aishan`;

  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// أمر /balance
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const { data: user } = await supabase
      .from("users")
      .select("balance")
      .eq("telegram_id", chatId)
      .single();

    const balance = user?.balance || 0;
    
    bot.sendMessage(
      chatId,
      `💰 *رصيدك الحالي:* ${balance} ريال يمني\n\n` +
      `🆔 رقم حسابك: ${chatId}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    bot.sendMessage(chatId, "⚠ حدث خطأ في جلب بيانات الرصيد.");
  }
});

// أمر /menu
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  sendMainMenu(chatId, msg.from?.first_name);
});

/* ==================== معالجة Callbacks ==================== */

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  console.log(`🔘 Callback from ${chatId}: ${data}`);

  try {
    // التحقق من الاشتراكات
    if (data === "check_channels" || data === "refresh_channels") {
      const notJoined = await checkSubscriptions(chatId);

      if (notJoined.length > 0) {
        let text = `❌ لا زلت لم تنضم لجميع القنوات:\n\n`;

        for (let ch of notJoined) {
          text += `📢 ${ch.name}\n`;
          text += `🔗 ${ch.link}\n\n`;
        }

        return bot.editMessageText(
          text,
          {
            chat_id: chatId,
            message_id: messageId,
            ...generateKeyboard([
              { text: "🔄 تحقق مرة أخرى", data: "check_channels" },
              { text: "🔄 تحديث القنوات", data: "refresh_channels" }
            ])
          }
        );
      }

      return sendMainMenu(chatId);
    }

    // القائمة الرئيسية
    if (data === "main_menu") {
      return sendMainMenu(chatId);
    }

    // اختيار التطبيق
    if (data === "choose_app") {
      return bot.editMessageText(
        "📱 *اختر التطبيق:*\n\n" +
        "اختر التطبيق الذي تريد الحصول على رقم له:",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          ...generateKeyboard([
            { text: "واتساب 📱", data: "app_whatsapp" },
            { text: "تليجرام ✈️", data: "app_telegram" },
            { text: "فيسبوك 📘", data: "app_facebook" },
            { text: "↩️ العودة", data: "main_menu" }
          ], 2)
        }
      );
    }

    // اختيار دولة للتطبيق
    if (data.startsWith("app_")) {
      const app = data.split("_")[1];

      try {
        const countries = await provider.getCountries(app);
        
        if (!countries || countries.length === 0) {
          return bot.editMessageText(
            `❌ لا تتوفر أرقام لـ ${app} حالياً.\nحاول مرة أخرى لاحقاً.`,
            {
              chat_id: chatId,
              message_id: messageId,
              ...generateKeyboard([
                { text: "🔄 تحديث", data: `app_${app}` },
                { text: "↩️ العودة", data: "choose_app" }
              ])
            }
          );
        }

        const keyboard = countries.map(c => ({
          text: `${c.flag || '🌐'} ${c.name} (${c.available})`,
          data: `country_${app}_${c.key}`
        }));

        keyboard.push({ text: "↩️ العودة", data: "choose_app" });

        return bot.editMessageText(
          `🌍 *اختر الدولة لـ ${app}:*\n\n` +
          `اختر الدولة التي تريد الرقم منها:`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...generateKeyboard(keyboard, 2)
          }
        );
      } catch (error) {
        console.error(`Error getting countries for ${app}:`, error);
        return bot.editMessageText(
          "❌ حدث خطأ في جلب الدول. حاول مرة أخرى.",
          {
            chat_id: chatId,
            message_id: messageId,
            ...generateKeyboard([
              { text: "↩️ العودة", data: "choose_app" }
            ])
          }
        );
      }
    }

    // اختيار دولة وشراء رقم
    if (data.startsWith("country_")) {
      const parts = data.split("_");
      const app = parts[1];
      const countryKey = parts[2];

      await bot.answerCallbackQuery(query.id, { text: "⏳ جاري طلب الرقم..." });

      try {
        const number = await provider.getNumber(countryKey, app);

        if (!number) {
          return bot.sendMessage(
            chatId,
            `❌ لا تتوفر أرقام لـ ${app} في ${countryKey} حالياً.\nحاول مرة أخرى لاحقاً.`,
            generateKeyboard([
              { text: "🔄 تحديث", data: `country_${app}_${countryKey}` },
              { text: "↩️ العودة", data: `app_${app}` }
            ])
          );
        }

        // حفظ الطلب في قاعدة البيانات
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("telegram_id", chatId)
          .single();

        if (user) {
          await supabase.from("orders").insert({
            user_id: user.id,
            number: number,
            country: countryKey,
            app_code: app,
            status: "waiting",
            created_at: new Date().toISOString()
          });
        }

        // إرسال رسالة النجاح
        const appNames = {
          whatsapp: "واتساب",
          telegram: "تليجرام",
          facebook: "فيسبوك"
        };

        const successText = `✅ *تم شراء رقم جديد بنجاح*\n\n` +
          `🌍 *الدولة:* ${countryKey}\n` +
          `📱 *التطبيق:* ${appNames[app] || app}\n` +
          `📞 *الرقم:* \`${number}\`\n` +
          `💰 *السعر:* 0 ريال يمني\n\n` +
          `⏳ *انتظر دقيقتين ثم اطلب الكود*`;

        await bot.sendMessage(
          chatId,
          successText,
          {
            parse_mode: 'Markdown',
            ...generateKeyboard([
              { text: "📨 طلب الكود", data: `get_code_${number}` },
              { text: "🔄 تحديث الرقم", data: `refresh_number_${number}` },
              { text: "↩️ العودة", data: "choose_app" }
            ], 2)
          }
        );

        // حذف الرسالة القديمة
        try {
          await bot.deleteMessage(chatId, messageId);
        } catch (e) {
          // تجاهل أخطاء حذف الرسالة
        }

      } catch (error) {
        console.error("Error purchasing number:", error);
        bot.sendMessage(
          chatId,
          "❌ حدث خطأ أثناء شراء الرقم. حاول مرة أخرى.",
          generateKeyboard([
            { text: "↩️ العودة", data: "choose_app" }
          ])
        );
      }

      return bot.answerCallbackQuery(query.id);
    }

    // طلب الكود
    if (data.startsWith("get_code_")) {
      const number = data.replace("get_code_", "");
      
      await bot.answerCallbackQuery(query.id, { text: "⏳ جاري طلب الكود..." });

      try {
        const sms = await provider.getSms(number);
        
        if (!sms) {
          return bot.sendMessage(
            chatId,
            `📭 *الرقم:* \`${number}\`\n\n` +
            `❌ لم يصلك أي كود بعد.\n` +
            `انتظر قليلاً ثم حاول مرة أخرى.`,
            {
              parse_mode: 'Markdown',
              ...generateKeyboard([
                { text: "🔄 حاول مرة أخرى", data: `get_code_${number}` },
                { text: "❌ إلغاء الرقم", data: `cancel_number_${number}` }
              ])
            }
          );
        }

        bot.sendMessage(
          chatId,
          `📨 *تم استلام الكود*\n\n` +
          `📞 *الرقم:* \`${number}\`\n\n` +
          `📝 *الرسالة:*\n\`\`\`\n${sms}\n\`\`\`\n\n` +
          `✅ تم استلام الرسالة بنجاح`,
          {
            parse_mode: 'Markdown',
            ...generateKeyboard([
              { text: "🔄 طلب كود آخر", data: `get_code_${number}` },
              { text: "🏠 القائمة الرئيسية", data: "main_menu" }
            ])
          }
        );

      } catch (error) {
        console.error("Error getting SMS:", error);
        bot.sendMessage(
          chatId,
          "❌ حدث خطأ في جلب الكود. حاول مرة أخرى."
        );
      }

      return bot.answerCallbackQuery(query.id);
    }

    // الدعم
    if (data === "support") {
      return bot.editMessageText(
        "🛠 *الدعم الفني*\n\n" +
        "لأي استفسار أو مشكلة:\n\n" +
        "👤 الدعم: @abdullah_aishan\n" +
        "📧 قنوات الدعم: @abdullah_aishan",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          ...generateKeyboard([
            { text: "🏠 القائمة الرئيسية", data: "main_menu" }
          ])
        }
      );
    }

    // قسم API
    if (data === "api_section") {
      return bot.editMessageText(
        "🔌 *قسم API*\n\n" +
        "هذه الميزة قيد التطوير حالياً.\n" +
        "سيتم تفعيلها قريباً إن شاء الله.",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          ...generateKeyboard([
            { text: "🏠 القائمة الرئيسية", data: "main_menu" }
          ])
        }
      );
    }

    // إحصائيات الإدمن
    if (data === "admin_stats") {
      if (!ADMIN_ID || chatId.toString() !== ADMIN_ID.toString()) {
        return bot.answerCallbackQuery(query.id, { text: "❌ غير مصرح لك!" });
      }

      try {
        // إحصائيات المستخدمين
        const { count: usersCount } = await supabase
          .from("users")
          .select("*", { count: 'exact', head: true });

        // إحصائيات الطلبات
        const { count: ordersCount } = await supabase
          .from("orders")
          .select("*", { count: 'exact', head: true });

        // الطلبات النشطة
        const { count: activeOrders } = await supabase
          .from("orders")
          .select("*", { count: 'exact', head: true })
          .eq("status", "waiting");

        const statsText = `📊 *إحصائيات البوت*\n\n` +
          `👥 *المستخدمين:* ${usersCount || 0}\n` +
          `📦 *الطلبات الكلية:* ${ordersCount || 0}\n` +
          `⏳ *الطلبات النشطة:* ${activeOrders || 0}\n` +
          `🕐 *تاريخ التقرير:* ${new Date().toLocaleDateString('ar-SA')}\n\n` +
          `🆔 *رقمك:* ${chatId}`;

        return bot.editMessageText(
          statsText,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...generateKeyboard([
              { text: "🔄 تحديث", data: "admin_stats" },
              { text: "🏠 القائمة", data: "main_menu" }
            ])
          }
        );
      } catch (error) {
        console.error("Error in admin stats:", error);
        return bot.answerCallbackQuery(query.id, { text: "❌ خطأ في جلب الإحصائيات" });
      }
    }

    // تحديث الرقم
    if (data.startsWith("refresh_number_")) {
      await bot.answerCallbackQuery(query.id, { text: "⏳ جاري تحديث حالة الرقم..." });
      // هنا يمكنك إضافة منطق لتحديث حالة الرقم
      return bot.answerCallbackQuery(query.id, { text: "✅ تم التحديث" });
    }

    // إلغاء الرقم
    if (data.startsWith("cancel_number_")) {
      const number = data.replace("cancel_number_", "");
      
      await bot.answerCallbackQuery(query.id, { text: "⏳ جاري إلغاء الرقم..." });
      
      // تحديث حالة الطلب إلى ملغى
      await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("number", number);

      bot.sendMessage(
        chatId,
        `❌ *تم إلغاء الرقم:* \`${number}\``,
        {
          parse_mode: 'Markdown',
          ...generateKeyboard([
            { text: "🏠 القائمة الرئيسية", data: "main_menu" }
          ])
        }
      );
      
      return bot.answerCallbackQuery(query.id, { text: "✅ تم الإلغاء" });
    }

  } catch (error) {
    console.error("Callback handler error:", error);
    bot.answerCallbackQuery(query.id, { text: "⚠ حدث خطأ غير متوقع" });
    
    try {
      bot.sendMessage(
        chatId,
        "❌ حدث خطأ في المعالجة. حاول مرة أخرى.",
        generateKeyboard([
          { text: "🏠 القائمة الرئيسية", data: "main_menu" }
        ])
      );
    } catch (e) {
      // تجاهل أخطاء إرسال الرسالة
    }
  }

  bot.answerCallbackQuery(query.id);
});

/* ==================== معالجة الأخطاء ==================== */

bot.on("polling_error", (error) => {
  console.error("Polling error:", error.message);
});

bot.on("webhook_error", (error) => {
  console.error("Webhook error:", error.message);
});

/* ==================== إشعارات الأرقام الجديدة ==================== */

async function notifyNewNumbers() {
  if (!CHANNELS_CHECK_ENABLED) {
    return; // تعطيل الإشعارات إذا كان التحقق معطلاً
  }

  try {
    console.log("🔍 Checking for new numbers...");
    
    const apps = ["whatsapp", "telegram", "facebook"];
    let newNumbersFound = false;

    for (let app of apps) {
      try {
        const countries = await provider.getCountries(app);

        for (let country of countries) {
          if (country.available > 0) {
            newNumbersFound = true;
            
            // إرسال إشعار للإدمن فقط إذا كان موجوداً
            if (ADMIN_ID) {
              try {
                await bot.sendMessage(
                  ADMIN_ID,
                  `📢 *إشعار أرقام جديدة*\n\n` +
                  `📱 *التطبيق:* ${app}\n` +
                  `🌍 *الدولة:* ${country.name}\n` +
                  `🔢 *الكمية:* ${country.available} رقم\n` +
                  `⏰ *الوقت:* ${new Date().toLocaleTimeString('ar-SA')}`,
                  { parse_mode: 'Markdown' }
                );
              } catch (adminError) {
                console.error("Error sending admin notification:", adminError);
              }
            }
          }
        }
      } catch (appError) {
        console.error(`Error checking numbers for ${app}:`, appError);
      }
    }

    if (!newNumbersFound) {
      console.log("📭 No new numbers available");
    }

  } catch (error) {
    console.error("Notification error:", error);
  }

  // تكرار الفحص كل 5 دقائق
  setTimeout(notifyNewNumbers, 5 * 60 * 1000);
}

// بدء خدمة الإشعارات بعد 30 ثانية من التشغيل
setTimeout(notifyNewNumbers, 30000);

/* ==================== تصدير البوت ==================== */

module.exports = bot;

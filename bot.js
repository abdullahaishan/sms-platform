const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db");
const provider = require("./provider");
const axios = require("axios");

module.exports = (bot) => {
  console.log("🤖 Bot module loaded successfully");

  /* ==================== دوال المساعدة ==================== */
  
  // إنشاء كيبورد إنلاين
  function createInlineKeyboard(buttons, columns = 2) {
    const keyboard = [];
    let row = [];

    buttons.forEach((button, index) => {
      row.push({
        text: button.text,
        callback_data: button.data
      });

      if (row.length === columns || index === buttons.length - 1) {
        keyboard.push(row);
        row = [];
      }
    });

    return {
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
  }

  // إنشاء كيبورد عادي
  function createKeyboard(buttons, columns = 2) {
    const keyboard = [];
    let row = [];

    buttons.forEach((button, index) => {
      row.push(button);

      if (row.length === columns || index === buttons.length - 1) {
        keyboard.push(row);
        row = [];
      }
    });

    return {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // التحقق من رصيد المستخدم
  async function checkUserBalance(chatId) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("balance")
        .eq("telegram_id", chatId)
        .single();

      if (error) return 0;
      return data?.balance || 0;
    } catch (error) {
      console.error("Error checking balance:", error);
      return 0;
    }
  }

  // تحديث رصيد المستخدم
  async function updateUserBalance(chatId, amount) {
    try {
      await supabase
        .from("users")
        .update({ balance: amount })
        .eq("telegram_id", chatId);
    } catch (error) {
      console.error("Error updating balance:", error);
    }
  }

  // جلب معلومات المستخدم أو إنشاءه
  async function getOrCreateUser(chatId, username, firstName) {
    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", chatId)
        .single();

      if (existingUser) {
        // تحديث آخر نشاط
        await supabase
          .from("users")
          .update({ 
            last_active: new Date().toISOString(),
            username: username || existingUser.username
          })
          .eq("telegram_id", chatId);
        
        return existingUser;
      }

      // إنشاء مستخدم جديد
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          telegram_id: chatId,
          username: username,
          first_name: firstName,
          balance: 0,
          created_at: new Date().toISOString(),
          last_active: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return newUser;
    } catch (error) {
      console.error("Error in getOrCreateUser:", error);
      return null;
    }
  }

  /* ==================== القائمة الرئيسية ==================== */
  
  async function showMainMenu(chatId, firstName = "المستخدم") {
    const balance = await checkUserBalance(chatId);
    
    const message = `👋 *مرحباً ${firstName} في بوت الأرقام* 📱

💰 *رصيدك الحالي:* ${balance} نقطة
🆔 *رقم حسابك:* ${chatId}

*اختر من القائمة أدناه:*`;

    const keyboard = createInlineKeyboard([
      { text: "📱 شراء رقم", data: "buy_number" },
      { text: "💰 رصيدي", data: "my_balance" },
      { text: "📊 المخزون", data: "check_stock" },
      { text: "📋 طلباتي", data: "my_orders" },
      { text: "🆘 المساعدة", data: "help_menu" },
      { text: "👨‍💻 الدعم", data: "support" }
    ], 2);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }

  /* ==================== معالجة الأوامر ==================== */

  // أمر /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name || "المستخدم";

    console.log(`📥 New user: ${chatId} (${username || 'no-username'})`);

    // حفظ المستخدم في قاعدة البيانات
    await getOrCreateUser(chatId, username, firstName);

    // عرض القائمة الرئيسية
    await showMainMenu(chatId, firstName);
  });

  // أمر /menu
  bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    await showMainMenu(chatId, msg.from.first_name);
  });

  // أمر /balance
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const balance = await checkUserBalance(chatId);
    
    await bot.sendMessage(
      chatId,
      `💰 *رصيدك الحالي:* ${balance} نقطة\n` +
      `🆔 *رقم حسابك:* ${chatId}\n\n` +
      `لشراء نقاط: @abdullah_aishan`,
      { parse_mode: 'Markdown' }
    );
  });

  // أمر /help
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpText = `*📱 مركز المساعدة*\n\n` +
      `*الأوامر المتاحة:*\n` +
      `/start - بدء البوت\n` +
      `/menu - القائمة الرئيسية\n` +
      `/balance - معرفة الرصيد\n` +
      `/stock - عرض المخزون\n` +
      `/number <كودالدولة>,<التطبيق> - شراء رقم\n` +
      `/sms <الرقم> - طلب الرسالة\n` +
      `/help - هذه الرسالة\n\n` +
      `*أمثلة:*\n` +
      `/number 6,whatsapp\n` +
      `/sms 123456789\n\n` +
      `*الدعم الفني:*\n` +
      `@abdullah_aishan`;

    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  });

  // أمر /stock
  bot.onText(/\/stock/, async (msg) => {
    const chatId = msg.chat.id;
    
    await bot.sendMessage(chatId, "⏳ جاري جلب المخزون...");
    
    try {
      const response = await axios.get("https://numbros.shop/jj/prices.json");
      let stockMessage = "*📊 المخزون الحالي:*\n\n";
      
      for (const country in response.data) {
        const count = response.data[country].count || 0;
        stockMessage += `🌍 ${country}: ${count} رقم\n`;
      }
      
      await bot.sendMessage(chatId, stockMessage, {
        parse_mode: 'Markdown',
        ...createInlineKeyboard([
          { text: "🔄 تحديث", data: "refresh_stock" },
          { text: "🏠 الرئيسية", data: "main_menu" }
        ])
      });
    } catch (error) {
      console.error("Error fetching stock:", error);
      await bot.sendMessage(chatId, "❌ حدث خطأ في جلب المخزون");
    }
  });

  // أمر /number - النسخة القديمة (للتوافق)
  bot.onText(/\/number (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1];
    const [country, app] = input.split(",");
    
    if (!country || !app) {
      return bot.sendMessage(
        chatId,
        "❌ استخدم: `/number كودالدولة,التطبيق`\nمثال: `/number 6,whatsapp`",
        { parse_mode: 'Markdown' }
      );
    }

    await processNumberPurchase(chatId, country.trim(), app.trim());
  });

  // دالة معالجة شراء الرقم
  async function processNumberPurchase(chatId, country, app) {
    try {
      await bot.sendMessage(chatId, `⏳ جاري البحث عن رقم ${app} في ${country}...`);
      
      // التحقق من الرصيد
      const balance = await checkUserBalance(chatId);
      const price = 1; // سعر الرقم (يمكن تعديله)
      
      if (balance < price) {
        return bot.sendMessage(
          chatId,
          `❌ رصيدك غير كافي!\n\n` +
          `💰 الرصيد المطلوب: ${price} نقطة\n` +
          `💰 رصيدك الحالي: ${balance} نقطة\n\n` +
          `لشراء نقاط: @abdullah_aishan`
        );
      }

      // طلب الرقم من المزود
      const number = await provider.getNumber(country, app);
      
      if (!number || number.includes("NO") || number.includes("ERROR")) {
        return bot.sendMessage(
          chatId,
          `❌ لا تتوفر أرقام ${app} في ${country} حالياً.\nحاول مرة أخرى لاحقاً.`,
          createInlineKeyboard([
            { text: "🔄 حاول مرة أخرى", data: `retry_${country}_${app}` },
            { text: "🏠 الرئيسية", data: "main_menu" }
          ])
        );
      }

      // جلب بيانات المستخدم
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", chatId)
        .single();

      if (user) {
        // خصم السعر من الرصيد
        const newBalance = balance - price;
        await updateUserBalance(chatId, newBalance);
        
        // حفظ الطلب في قاعدة البيانات
        await supabase.from("orders").insert({
          user_id: user.id,
          number: number,
          country: country,
          app_code: app,
          price: price,
          status: "active",
          created_at: new Date().toISOString()
        });
      }

      // إرسال رسالة النجاح
      const appNames = {
        whatsapp: "واتساب 📱",
        telegram: "تليجرام ✈️",
        facebook: "فيسبوك 📘",
        twitter: "تويتر 🐦",
        instagram: "انستجرام 📸"
      };

      const successMessage = `✅ *تم شراء الرقم بنجاح!*\n\n` +
        `📱 *التطبيق:* ${appNames[app] || app}\n` +
        `🌍 *الدولة:* ${country}\n` +
        `📞 *الرقم:* \`${number}\`\n` +
        `💰 *السعر:* ${price} نقطة\n` +
        `💰 *الرصيد الجديد:* ${newBalance} نقطة\n\n` +
        `*لطلب الرسالة:*\n` +
        `1. انتظر دقيقتين\n` +
        `2. أرسل /sms ${number}\n` +
        `3. أو اضغط زر "📨 طلب الكود"`;

      await bot.sendMessage(
        chatId,
        successMessage,
        {
          parse_mode: 'Markdown',
          ...createInlineKeyboard([
            { text: "📨 طلب الكود", data: `sms_${number}` },
            { text: "🔄 رقم جديد", data: "buy_number" },
            { text: "🏠 الرئيسية", data: "main_menu" }
          ])
        }
      );

    } catch (error) {
      console.error("Error in processNumberPurchase:", error);
      await bot.sendMessage(
        chatId,
        "❌ حدث خطأ أثناء شراء الرقم. حاول مرة أخرى.",
        createInlineKeyboard([
          { text: "🔄 المحاولة مرة أخرى", data: "buy_number" },
          { text: "🏠 الرئيسية", data: "main_menu" }
        ])
      );
    }
  }

  // أمر /sms - النسخة القديمة
  bot.onText(/\/sms (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const number = match[1];
    
    if (!number) {
      return bot.sendMessage(
        chatId,
        "❌ استخدم: `/sms الرقم`\nمثال: `/sms 123456789`",
        { parse_mode: 'Markdown' }
      );
    }

    await processSmsRequest(chatId, number.trim());
  });

  // دالة معالجة طلب الرسالة
  async function processSmsRequest(chatId, number) {
    try {
      await bot.sendMessage(chatId, `⏳ جاري طلب الرسالة للرقم ${number}...`);
      
      const sms = await provider.getSms(number);
      
      if (!sms || sms.includes("NO_SMS") || sms.includes("WAIT_CODE")) {
        return bot.sendMessage(
          chatId,
          `📭 *الرقم:* \`${number}\`\n\n` +
          `❌ لم يصلك أي كود بعد.\n` +
          `⏳ انتظر قليلاً ثم حاول مرة أخرى.`,
          {
            parse_mode: 'Markdown',
            ...createInlineKeyboard([
              { text: "🔄 حاول مرة أخرى", data: `sms_${number}` },
              { text: "🏠 الرئيسية", data: "main_menu" }
            ])
          }
        );
      }

      // تحديث حالة الطلب
      await supabase
        .from("orders")
        .update({ 
          status: "completed",
          sms_received: sms,
          completed_at: new Date().toISOString()
        })
        .eq("number", number);

      await bot.sendMessage(
        chatId,
        `📨 *تم استلام الرسالة!*\n\n` +
        `📞 *الرقم:* \`${number}\`\n\n` +
        `📝 *الرسالة:*\n\`\`\`\n${sms}\n\`\`\`\n\n` +
        `✅ تم استلام الكود بنجاح`,
        {
          parse_mode: 'Markdown',
          ...createInlineKeyboard([
            { text: "📱 شراء رقم آخر", data: "buy_number" },
            { text: "🏠 الرئيسية", data: "main_menu" }
          ])
        }
      );

    } catch (error) {
      console.error("Error in processSmsRequest:", error);
      await bot.sendMessage(
        chatId,
        "❌ حدث خطأ في جلب الرسالة. حاول مرة أخرى."
      );
    }
  }

  /* ==================== معالجة Callbacks ==================== */

  bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    console.log(`🔘 Callback from ${chatId}: ${data}`);

    try {
      await bot.answerCallbackQuery(callbackQuery.id);

      // القائمة الرئيسية
      if (data === "main_menu") {
        await bot.deleteMessage(chatId, messageId);
        await showMainMenu(chatId);
        return;
      }

      // شراء رقم
      if (data === "buy_number") {
        const apps = [
          { name: "واتساب", code: "whatsapp", emoji: "📱" },
          { name: "تليجرام", code: "telegram", emoji: "✈️" },
          { name: "فيسبوك", code: "facebook", emoji: "📘" },
          { name: "تويتر", code: "twitter", emoji: "🐦" }
        ];

        const keyboard = apps.map(app => ({
          text: `${app.emoji} ${app.name}`,
          data: `choose_app_${app.code}`
        }));

        keyboard.push({ text: "🏠 الرئيسية", data: "main_menu" });

        await bot.editMessageText(
          "📱 *اختر التطبيق:*\n\nاختر التطبيق الذي تريد رقم له:",
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...createInlineKeyboard(keyboard, 2)
          }
        );
        return;
      }

      // اختيار التطبيق
      if (data.startsWith("choose_app_")) {
        const app = data.replace("choose_app_", "");
        
        // هنا يمكنك جلب الدول المتاحة من provider.js
        // للمثال سنعرض دول افتراضية
        const countries = [
          { code: "6", name: "مصر 🇪🇬" },
          { code: "7", name: "السعودية 🇸🇦" },
          { code: "30", name: "الولايات المتحدة 🇺🇸" },
          { code: "31", name: "هولندا 🇳🇱" },
          { code: "44", name: "بريطانيا 🇬🇧" },
          { code: "49", name: "ألمانيا 🇩🇪" }
        ];

        const keyboard = countries.map(country => ({
          text: country.name,
          data: `purchase_${app}_${country.code}`
        }));

        keyboard.push(
          { text: "↩️ رجوع", data: "buy_number" },
          { text: "🏠 الرئيسية", data: "main_menu" }
        );

        const appNames = {
          whatsapp: "واتساب",
          telegram: "تليجرام",
          facebook: "فيسبوك",
          twitter: "تويتر"
        };

        await bot.editMessageText(
          `🌍 *اختر الدولة لـ ${appNames[app] || app}:*`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...createInlineKeyboard(keyboard, 2)
          }
        );
        return;
      }

      // شراء رقم محدد
      if (data.startsWith("purchase_")) {
        const parts = data.split("_");
        const app = parts[1];
        const country = parts[2];
        
        await bot.deleteMessage(chatId, messageId);
        await processNumberPurchase(chatId, country, app);
        return;
      }

      // رصيدي
      if (data === "my_balance") {
        const balance = await checkUserBalance(chatId);
        
        await bot.editMessageText(
          `💰 *رصيدك الحالي:* ${balance} نقطة\n\n` +
          `🆔 *رقم حسابك:* ${chatId}\n\n` +
          `لشراء نقاط: @abdullah_aishan`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...createInlineKeyboard([
              { text: "💳 شراء نقاط", data: "buy_points" },
              { text: "📱 شراء رقم", data: "buy_number" },
              { text: "🏠 الرئيسية", data: "main_menu" }
            ])
          }
        );
        return;
      }

      // المخزون
      if (data === "check_stock" || data === "refresh_stock") {
        await bot.editMessageText("⏳ جاري تحديث المخزون...", {
          chat_id: chatId,
          message_id: messageId
        });

        try {
          const response = await axios.get("https://numbros.shop/jj/prices.json");
          let stockMessage = "*📊 المخزون الحالي:*\n\n";
          
          for (const country in response.data) {
            const count = response.data[country].count || 0;
            if (count > 0) {
              stockMessage += `✅ ${country}: ${count} رقم\n`;
            } else {
              stockMessage += `❌ ${country}: غير متوفر\n`;
            }
          }
          
          await bot.editMessageText(
            stockMessage,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              ...createInlineKeyboard([
                { text: "🔄 تحديث", data: "refresh_stock" },
                { text: "📱 شراء رقم", data: "buy_number" },
                { text: "🏠 الرئيسية", data: "main_menu" }
              ])
            }
          );
        } catch (error) {
          await bot.editMessageText(
            "❌ حدث خطأ في جلب المخزون",
            {
              chat_id: chatId,
              message_id: messageId,
              ...createInlineKeyboard([
                { text: "🔄 حاول مرة أخرى", data: "refresh_stock" },
                { text: "🏠 الرئيسية", data: "main_menu" }
              ])
            }
          );
        }
        return;
      }

      // طلب كود SMS
      if (data.startsWith("sms_")) {
        const number = data.replace("sms_", "");
        await bot.deleteMessage(chatId, messageId);
        await processSmsRequest(chatId, number);
        return;
      }

      // المساعدة
      if (data === "help_menu") {
        const helpText = `*📱 مركز المساعدة*\n\n` +
          `*كيفية الاستخدام:*\n` +
          `1. اضغط "شراء رقم"\n` +
          `2. اختر التطبيق\n` +
          `3. اختر الدولة\n` +
          `4. سيتم إرسال الرقم لك\n` +
          `5. انتظر دقيقتين ثم اضغط "طلب الكود"\n\n` +
          `*الدعم الفني:*\n@abdullah_aishan`;

        await bot.editMessageText(
          helpText,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...createInlineKeyboard([
              { text: "📱 تجربة الشراء", data: "buy_number" },
              { text: "🏠 الرئيسية", data: "main_menu" }
            ])
          }
        );
        return;
      }

      // الدعم
      if (data === "support") {
        await bot.editMessageText(
          "*👨‍💻 الدعم الفني*\n\n" +
          "لأي استفسار أو مشكلة:\n\n" +
          "👤 المسؤول: @abdullah_aishan\n" +
          "📧 قنوات الدعم: @abdullah_aishan\n\n" +
          "*ساعات الدعم:*\n24/7",
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...createInlineKeyboard([
              { text: "📱 شراء رقم", data: "buy_number" },
              { text: "🏠 الرئيسية", data: "main_menu" }
            ])
          }
        );
        return;
      }

      // طلباتي
      if (data === "my_orders") {
        try {
          const { data: user } = await supabase
            .from("users")
            .select("id")
            .eq("telegram_id", chatId)
            .single();

          if (!user) {
            await bot.editMessageText(
              "❌ لم يتم العثور على حسابك",
              {
                chat_id: chatId,
                message_id: messageId,
                ...createInlineKeyboard([
                  { text: "🏠 الرئيسية", data: "main_menu" }
                ])
              }
            );
            return;
          }

          const { data: orders, error } = await supabase
            .from("orders")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10);

          if (error || !orders || orders.length === 0) {
            await bot.editMessageText(
              "📭 لا توجد طلبات سابقة",
              {
                chat_id: chatId,
                message_id: messageId,
                ...createInlineKeyboard([
                  { text: "📱 شراء أول رقم", data: "buy_number" },
                  { text: "🏠 الرئيسية", data: "main_menu" }
                ])
              }
            );
            return;
          }

          let ordersText = "*📋 آخر 10 طلبات:*\n\n";
          
          orders.forEach((order, index) => {
            const statusEmoji = order.status === "completed" ? "✅" : "⏳";
            ordersText += `${index + 1}. ${statusEmoji} ${order.app_code}\n`;
            ordersText += `   📞 ${order.number}\n`;
            ordersText += `   🌍 ${order.country}\n`;
            ordersText += `   📅 ${new Date(order.created_at).toLocaleDateString('ar-SA')}\n\n`;
          });

          await bot.editMessageText(
            ordersText,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              ...createInlineKeyboard([
                { text: "📱 شراء جديد", data: "buy_number" },
                { text: "🏠 الرئيسية", data: "main_menu" }
              ])
            }
          );
        } catch (error) {
          console.error("Error fetching orders:", error);
          await bot.editMessageText(
            "❌ حدث خطأ في جلب الطلبات",
            {
              chat_id: chatId,
              message_id: messageId,
              ...createInlineKeyboard([
                { text: "🏠 الرئيسية", data: "main_menu" }
              ])
            }
          );
        }
        return;
      }

      // إعادة المحاولة
      if (data.startsWith("retry_")) {
        const parts = data.split("_");
        const country = parts[1];
        const app = parts[2];
        
        await bot.deleteMessage(chatId, messageId);
        await processNumberPurchase(chatId, country, app);
        return;
      }

      // شراء نقاط
      if (data === "buy_points") {
        await bot.editMessageText(
          "*💳 شراء نقاط*\n\n" +
          "لشراء نقاط وتفعيل حسابك:\n\n" +
          "👤 تواصل مع المسؤول:\n" +
          "@abdullah_aishan\n\n" +
          "*بعد الدفع:*\n" +
          "1. أرسل إيصال الدفع\n" +
          "2. انتظر تفعيل الرصيد\n" +
          "3. سيتم إشعارك فوراً",
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...createInlineKeyboard([
              { text: "💰 رصيدي", data: "my_balance" },
              { text: "🏠 الرئيسية", data: "main_menu" }
            ])
          }
        );
        return;
      }

    } catch (error) {
      console.error("Callback error:", error);
      try {
        await bot.sendMessage(
          chatId,
          "❌ حدث خطأ في المعالجة",
          createInlineKeyboard([
            { text: "🏠 الرئيسية", data: "main_menu" }
          ])
        );
      } catch (e) {
        // تجاهل أخطاء إرسال الرسالة
      }
    }
  });

  /* ==================== معالجة الأخطاء ==================== */

  bot.on("polling_error", (error) => {
    console.error("Polling error:", error);
  });

  bot.on("webhook_error", (error) => {
    console.error("Webhook error:", error);
  });

  /* ==================== إشعارات وإحصائيات ==================== */

  // إرسال إشعار للمسؤول عند تشغيل البوت
  setTimeout(async () => {
    try {
      // إحصائيات المستخدمين
      const { count: usersCount } = await supabase
        .from("users")
        .select("*", { count: 'exact', head: true });

      // إحصائيات الطلبات
      const { count: ordersCount } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true });

      console.log(`📊 إحصائيات البوت:`);
      console.log(`👥 المستخدمين: ${usersCount}`);
      console.log(`📦 الطلبات: ${ordersCount}`);
      console.log(`🤖 البوت جاهز للعمل!`);
      
    } catch (error) {
      console.error("Error in startup stats:", error);
    }
  }, 5000);
};

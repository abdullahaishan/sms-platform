const TelegramBot = require("node-telegram-bot-api");
const supabase = require("./db");
const provider = require("./provider");
const axios = require("axios");

module.exports = (bot) => {
  console.log("🤖 Bot module loaded successfully");

  /* ==================== دوال مساعدة ==================== */
  function createInlineKeyboard(buttons, columns = 2) {
    const keyboard = [];
    let row = [];
    buttons.forEach((b, i) => {
      row.push({ text: b.text, callback_data: b.data });
      if (row.length === columns || i === buttons.length - 1) {
        keyboard.push(row);
        row = [];
      }
    });
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  async function checkUserBalance(chatId) {
    try {
      const { data, error } = await supabase.from("users").select("balance").eq("telegram_id", chatId).single();
      if (error) return 0;
      return data?.balance || 0;
    } catch { return 0; }
  }

  async function updateUserBalance(chatId, amount) {
    try {
      await supabase.from("users").update({ balance: amount }).eq("telegram_id", chatId);
    } catch (err) { console.error("Error updating balance:", err); }
  }

  async function getOrCreateUser(chatId, username, firstName) {
    try {
      const { data: existingUser } = await supabase.from("users").select("*").eq("telegram_id", chatId).single();
      if (existingUser) {
        await supabase.from("users").update({ last_active: new Date().toISOString(), username: username || existingUser.username }).eq("telegram_id", chatId);
        return existingUser;
      }
      const { data: newUser, error } = await supabase.from("users").insert({
        telegram_id: chatId,
        username,
        first_name: firstName,
        balance: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      }).select().single();
      if (error) throw error;
      return newUser;
    } catch (err) { console.error("Error in getOrCreateUser:", err); return null; }
  }

  // دالة تحقق من صلاحية الأدمن
  async function isAdmin(chatId) {
    if (process.env.ADMIN_IDS) {
      const ids = process.env.ADMIN_IDS.split(",").map(x => x.trim());
      if (ids.includes(String(chatId))) return true;
    }
    try {
      const { data } = await supabase.from("users").select("is_admin").eq("telegram_id", chatId).single();
      return data?.is_admin === true;
    } catch (err) { console.error("isAdmin check error:", err.message); return false; }
  }

  /* ==================== القائمة الرئيسية ==================== */
  async function showMainMenu(chatId, firstName = "المستخدم") {
    const balance = await checkUserBalance(chatId);
    const message = `👋 *مرحباً ${firstName}*\n💰 *رصيدك:* ${balance} نقطة\n🆔 *رقمك:* ${chatId}\n*اختر من القائمة:*`;
    const keyboard = createInlineKeyboard([
      { text: "📱 شراء رقم", data: "buy_number" },
      { text: "💰 رصيدي", data: "my_balance" },
      { text: "📊 المخزون", data: "check_stock" },
      { text: "📋 طلباتي", data: "my_orders" },
      { text: "🆘 المساعدة", data: "help_menu" },
      { text: "👨‍💻 الدعم", data: "support" }
    ], 2);
    await bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...keyboard });
  }

  /* ==================== أوامر أساسية ==================== */
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name || "المستخدم";
    console.log(`📥 New user: ${chatId} (${username})`);
    await getOrCreateUser(chatId, username, firstName);
    await showMainMenu(chatId, firstName);
  });

  bot.onText(/\/menu/, async (msg) => { await showMainMenu(msg.chat.id, msg.from.first_name); });
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const balance = await checkUserBalance(chatId);
    await bot.sendMessage(chatId, `💰 رصيدك: ${balance} نقطة\n🆔 رقمك: ${chatId}`, { parse_mode: "Markdown" });
  });
  
  // يمكن دمج باقي أوامر الشراء /sms /stock /orders كما في كودك الأصلي، مع التأكد من استخدام isAdmin عند الوظائف الإدارية

  /* ==================== معالجة Callbacks ==================== */
  bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    await bot.answerCallbackQuery(callbackQuery.id);
    try {
      if (data === "main_menu") { await bot.deleteMessage(chatId, messageId); await showMainMenu(chatId); return; }
      // مثال: حماية خيار إضافة أرقام مدفوعة
      if (data === "add_paid_number") {
        if (!await isAdmin(chatId)) return bot.sendMessage(chatId, "❌ هذه الخاصية للأدمن فقط");
        await bot.sendMessage(chatId, "✅ يمكن الآن إضافة رقم مدفوع");
        return;
      }
      // باقي الأحداث مثل buy_number / choose_app / purchase_... تظل كما هي
    } catch (err) { console.error("Callback error:", err); }
  });

  /* ==================== إشعارات وإحصائيات ==================== */
  setTimeout(async () => {
    try {
      const { count: usersCount } = await supabase.from("users").select("*", { count: "exact", head: true });
      const { count: ordersCount } = await supabase.from("orders").select("*", { count: "exact", head: true });
      console.log(`📊 إحصائيات: المستخدمين=${usersCount}, الطلبات=${ordersCount}`);
    } catch (err) { console.error("Error in startup stats:", err); }
  }, 5000);
};

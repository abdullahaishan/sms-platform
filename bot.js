const supabase = require("./db");
const provider = require("./provider");

module.exports = (bot) => {

  /* ================== أدوات مساعدة ================== */

  function inline(buttons) {
    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  }

  async function getUser(telegramId, username) {
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from("users")
        .insert({
          telegram_id: telegramId,
          username: username
        })
        .select()
        .single();

      return newUser;
    }

    return user;
  }

  async function isAdmin(telegramId) {
    const { data } = await supabase
      .from("users")
      .select("is_admin")
      .eq("telegram_id", telegramId)
      .single();

    return data?.is_admin === true;
  }

  /* ================== إجبار الاشتراك ================== */

  async function checkSubscription(userId) {
    const { data: channels } = await supabase
      .from("channels")
      .select("*")
      .eq("is_active", true);

    if (!channels || channels.length === 0) return true;

    for (let ch of channels) {
      try {
        const member = await bot.getChatMember(ch.link, userId);
        if (member.status === "left") return false;
      } catch {
        return false;
      }
    }

    return true;
  }

  /* ================== القائمة الرئيسية ================== */

  async function mainMenu(chatId) {
    const user = await getUser(chatId);

    const buttons = [
      [{ text: "📱 شراء رقم مجاني", callback_data: "free_number" }],
      [{ text: "💎 أرقام مدفوعة", callback_data: "paid_numbers" }],
      [{ text: "💰 رصيدي", callback_data: "balance" }],
      [{ text: "📦 طلباتي", callback_data: "orders" }]
    ];

    if (await isAdmin(chatId)) {
      buttons.push([{ text: "🔐 لوحة التحكم", callback_data: "admin" }]);
    }

    bot.sendMessage(chatId,
      `👋 مرحباً\n💰 رصيدك: ${user.balance}\n📊 الحد اليومي: ${user.daily_limit}`,
      inline(buttons)
    );
  }

  /* ================== START ================== */

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    const subscribed = await checkSubscription(chatId);
    if (!subscribed) {
      return bot.sendMessage(chatId,
        "🚫 يجب الاشتراك بالقنوات أولاً");
    }

    await mainMenu(chatId);
  });

  /* ================== Callbacks ================== */

  bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    await bot.answerCallbackQuery(q.id);

    /* ==== رصيد ==== */
    if (data === "balance") {
      const user = await getUser(chatId);
      return bot.sendMessage(chatId,
        `💰 رصيدك الحالي: ${user.balance}`);
    }

    /* ==== أرقام مجانية ==== */
    if (data === "free_number") {

      const user = await getUser(chatId);

      if (user.daily_limit <= 0)
        return bot.sendMessage(chatId,
          "❌ انتهى حدك اليومي");

      const number = await provider.getNumber();

      if (!number)
        return bot.sendMessage(chatId,
          "❌ لا يوجد أرقام حالياً");

      await supabase.from("orders").insert({
        user_id: user.id,
        number: number,
        status: "waiting"
      });

      await supabase.from("users")
        .update({ daily_limit: user.daily_limit - 1 })
        .eq("id", user.id);

      return bot.sendMessage(chatId,
        `📱 رقمك:\n${number}`);
    }

    /* ==== أرقام مدفوعة ==== */
    if (data === "paid_numbers") {
      const { data: numbers } = await supabase
        .from("paid_numbers")
        .select("*")
        .eq("is_active", true);

      if (!numbers || numbers.length === 0)
        return bot.sendMessage(chatId,
          "❌ لا يوجد أرقام مدفوعة");

      const buttons = numbers.map(n => [{
        text: `${n.number} - ${n.price}$`,
        callback_data: `buy_paid_${n.id}`
      }]);

      return bot.sendMessage(chatId,
        "💎 اختر رقم:",
        inline(buttons));
    }

    if (data.startsWith("buy_paid_")) {
      const id = data.split("_")[2];

      const { data: number } = await supabase
        .from("paid_numbers")
        .select("*")
        .eq("id", id)
        .single();

      const user = await getUser(chatId);

      if (user.balance < number.price)
        return bot.sendMessage(chatId,
          "❌ رصيد غير كافي");

      await supabase.from("users")
        .update({ balance: user.balance - number.price })
        .eq("id", user.id);

      await supabase.from("paid_numbers")
        .update({ is_active: false })
        .eq("id", id);

      return bot.sendMessage(chatId,
        `✅ تم شراء الرقم:\n${number.number}`);
    }

    /* ==== لوحة تحكم الأدمن ==== */
    if (data === "admin") {
      if (!(await isAdmin(chatId)))
        return bot.sendMessage(chatId, "❌ غير مصرح");

      return bot.sendMessage(chatId,
        "🔐 لوحة التحكم",
        inline([
          [{ text: "➕ إضافة رقم مدفوع", callback_data: "add_paid" }]
        ])
      );
    }

  });

};

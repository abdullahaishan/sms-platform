require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const app = express();
app.use(express.json());

// إنشاء البوت
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// استدعاء البوت والأوامر
require("./bot")(bot);

// سيرفر بسيط لـ Render
app.get("/webhook-info", async (req, res) => {
  try {
    // بعض نسخ المكتبة تستخدم getWebHookInfo أو getWebhookInfo
    const info = bot.getWebHookInfo ? await bot.getWebHookInfo() :
                 bot.getWebhookInfo ? await bot.getWebhookInfo() : null;
    res.json(info || { error: "getWebhookInfo not supported by this lib version" });
  } catch (error) {
    res.json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

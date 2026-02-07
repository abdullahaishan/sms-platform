require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

// إنشاء البوت
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: false,
  webHook: true
});

// URL للـ Webhook
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL || `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;

console.log("🔧 Setting webhook to:", `${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);

// إعداد Webhook
bot.setWebHook(`${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`)
  .then(() => console.log("✅ Webhook set successfully"))
  .catch(err => console.error("❌ Webhook error:", err.message));

// مسار Webhook
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing update:", error);
    res.sendStatus(500);
  }
});

// صفحة الرئيسية
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Telegram Bot</title></head>
      <body style="text-align:center; font-family:Arial; padding:50px;">
        <h1>🤖 Telegram Bot is Running</h1>
        <div style="background:#28a745; color:white; padding:10px; border-radius:5px;">🚀 Status: Active</div>
        <p>Bot is ready to receive messages</p>
      </body>
    </html>
  `);
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Telegram SMS Bot",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Webhook info (آمن)
app.get("/webhook-info", async (req, res) => {
  try {
    const info = bot.getWebHookInfo ? await bot.getWebHookInfo() :
                 bot.getWebhookInfo ? await bot.getWebhookInfo() : null;
    res.json(info || { error: "getWebhookInfo not supported" });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// بدء البوت (ملف bot.js)
require("./bot")(bot);

// بدء السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Webhook URL: ${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);
  console.log(`🤖 Bot started successfully`);
});

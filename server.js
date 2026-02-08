require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

// ------------------- إنشاء البوت -------------------
const bot = require("./bot"); // استدعاء البوت مباشرة

// ------------------- Webhook -------------------
const WEBHOOK_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.WEBHOOK_URL ||
  `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;

const webhookPath = `/bot${process.env.BOT_TOKEN}`;
console.log("🔧 Setting webhook to:", WEBHOOK_URL + webhookPath);

bot.setWebHook(WEBHOOK_URL + webhookPath)
  .then(() => console.log("✅ Webhook set successfully"))
  .catch(err => console.error("❌ Webhook error:", err.message));

// ------------------- مسار Webhook -------------------
app.post(webhookPath, (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing update:", error);
    res.sendStatus(500);
  }
});

// ------------------- صفحة رئيسية -------------------
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🤖 Telegram Bot</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        h1 { color: #0088cc; }
        .status { background: #28a745; color: white; padding: 10px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>🤖 Telegram Bot is Running</h1>
      <div class="status">🚀 Status: Active</div>
      <p>Bot is ready to receive messages</p>
    </body>
    </html>
  `);
});

// ------------------- Health Check -------------------
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Telegram SMS Bot",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ------------------- Webhook Info -------------------
app.get("/webhook-info", async (req, res) => {
  try {
    const info = await bot.getWebHookInfo();
    res.json(info);
  } catch (error) {
    res.json({ error: error.message });
  }
});

// ------------------- تشغيل السيرفر -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Webhook URL: ${WEBHOOK_URL}${webhookPath}`);
});

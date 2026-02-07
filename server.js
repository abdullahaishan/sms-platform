require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
  console.error("❌ BOT_TOKEN is missing in environment variables");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on("polling_error", (error) => {
  console.error("Polling error:", error);
});

bot.on("message", (msg) => {
  bot.sendMessage(msg.chat.id, "✅ البوت يعمل بنجاح بعد التحديث الجديد");
});

app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

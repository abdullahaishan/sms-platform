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
app.get("/", (req, res) => {
  res.send("Bot is running...");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

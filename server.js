require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });

const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL;

bot.setWebHook(`${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);

app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("Bot is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

require("./bot")(bot);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: ${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);
});

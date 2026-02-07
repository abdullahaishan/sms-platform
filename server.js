require("dotenv").config();
const express = require("express");
const bot = require("./bot"); // استدعاء bot.js

const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body); // معالجة الرسائل القادمة من Telegram
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("Bot is running 🚀");
});

app.listen(process.env.PORT, () => {
  console.log("Server running...");
});

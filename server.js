// server.js
require("dotenv").config();
const express = require("express");
const bot = require("./bot"); // تشغيل البوت

const app = express();
app.use(express.json());

// Webhook route
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body); // تحديث البوت لكل الرسائل
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

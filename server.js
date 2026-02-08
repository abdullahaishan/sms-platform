require("dotenv").config();
const express = require("express");
require("./bot"); // تشغيل البوت polling

const app = express();

// صفحة الترحيب عند الدخول للرابط
app.get("/", (req, res) => {
  res.send("🤖 بوت الأرقام يعمل بنجاح!");
});

// Health check بسيط
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

require("dotenv").config();
const express = require("express");

const app = express();
app.use(express.json());

// استيراد البوت من ملف bot.js
const bot = require("./bot");

// إعداد Webhook
const WEBHOOK_URL = process.env.WEBHOOK_URL + "/webhook";

bot.setWebHook(WEBHOOK_URL)
  .then(() => console.log("✅ Webhook set successfully"))
  .catch(err => {
    console.error("❌ Webhook error:", err.message);
    console.log("⚠️  Trying to delete webhook first...");
    return bot.deleteWebHook().then(() => {
      console.log("🗑️  Old webhook deleted, retrying...");
      return bot.setWebHook(WEBHOOK_URL);
    });
  })
  .then(() => console.log("✅ Webhook set after retry"))
  .catch(err => console.error("❌ Failed to set webhook:", err.message));

// Webhook endpoint
app.post("/webhook", (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.sendStatus(500);
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "running", 
    service: "Telegram Bot",
    timestamp: new Date().toISOString()
  });
});

// Health endpoint for monitoring
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📞 Webhook URL: ${WEBHOOK_URL}`);
  console.log(`👤 Bot username: ${process.env.BOT_USERNAME || 'Not set'}`);
});

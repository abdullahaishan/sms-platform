require("dotenv").config();
const express = require("express");
require("./bot");

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running 🚀");
});

app.listen(process.env.PORT, () => {
  console.log("Server running...");
});
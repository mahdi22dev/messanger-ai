require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const {
  MetaVerificationProccess,
} = require("./controllers/MetaVerification.js");
const { handlePostRequest } = require("./controllers/postWebHook.js");
const { ensureTTLIndex } = require("./db.js");

const app = express();
const PORT = process.env.PORT || 3044;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res
    .status(200)
    .send(
      "This is the AI Chatbot API - Powered by Together AI, Gemini tested from local server",
    );
});
// Webhook Event Handling
app.post("/webhook", handlePostRequest);
app.get("/webhook", MetaVerificationProccess);

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // run start up functions, cleaners etc
  try {
    await ensureTTLIndex();
    console.log("MongoDB connected, TTL index ready");
  } catch (error) {
    console.error("MongoDB startup failed:", error.message);
  }
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

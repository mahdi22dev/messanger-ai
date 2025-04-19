const express = require("express");
const bodyParser = require("body-parser");
const {
  MetaVerificationProccess,
} = require("./controllers/MetaVerification.js");
const { handlePostRequest } = require("./controllers/postWebHook.js");
const { ensureTTLIndex } = require("./db.js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3044;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res
    .status(200)
    .send("This is the AI Chatbot API - Powered by Together AI, Gemini");
});
// Webhook Event Handling
app.post("/webhook", handlePostRequest);
app.get("/webhook", MetaVerificationProccess);

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // run start up functions, cleaners etc
  await ensureTTLIndex();
});

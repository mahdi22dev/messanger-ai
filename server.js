require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { handleGetRequest } = require("./controllers/getWebHook.js");
const { handlePostRequest } = require("./controllers/postWebHook.js");

const app = express();
const PORT = process.env.PORT || 3044;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).send("Test");
});
// Webhook Event Handling
app.post("/webhook", handlePostRequest);
app.get("/webhook", handleGetRequest);

// Send Message to User
const sendMessage = (recipientId, messageText) => {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const messageData = {
    recipient: { id: recipientId },
    message: { text: messageText },
  };

  axios
    .post(url, messageData)
    .then((response) => {
      console.log("Message sent!");
    })
    .catch((error) => {
      console.error("Error sending message:", error);
    });
};

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

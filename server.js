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

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

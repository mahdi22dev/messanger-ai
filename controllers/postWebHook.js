const { default: axios } = require("axios");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const handlePostRequest = (req, res) => {
  const body = req.body;
  console.log("request recived");
  if (body.object === "page") {
    body.entry.forEach((entry) => {
      const event = entry.messaging[0];
      console.log(event);

      if (event.message && event.message.text) {
        const senderId = event.sender.id;
        const receivedMessage = event.message.text;
        console.log(senderId);

        // Reply to user
        sendMessage(senderId, `You said: "${receivedMessage}"`);
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
};

const sendMessage = async (recipientId, messageText) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  const AI_Response = await sendPromt(generationConfig, model, messageText);
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  // Split the response into chunks, each up to 2000 characters
  const chunkSize = 2000;
  const chunks = [];
  // Ensure the chunking respects the 2000 character limit
  for (let i = 0; i < AI_Response.length; i += chunkSize) {
    chunks.push(AI_Response.substring(i, i + chunkSize));
  }
  for (const chunk of chunks) {
    const messageData = {
      recipient: { id: recipientId },
      message: { text: chunk },
    };
    await axios
      .post(url, messageData)
      .then((response) => {
        console.log("Message sent successfully!");
      })
      .catch((error) => {
        console.error("Error sending message chunk:", error);
      });
  }
};

async function sendPromt(generationConfig, model, prompt) {
  const chatSession = model.startChat({
    generationConfig,
    history: [],
  });

  const result = await chatSession.sendMessage(prompt);
  console.log(result.response.text());
  return result.response.text();
}

module.exports = {
  handlePostRequest: handlePostRequest,
};

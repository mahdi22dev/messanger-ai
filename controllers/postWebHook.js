const { default: axios } = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HfInference } = require("@huggingface/inference");
const { Together } = require("together-ai");
const {
  insertUserContext,
  deleteUserContextsById,
  getConversationHistory,
  getModelType,
  ensureTTLIndex,
  setPendingState,
  checkPendingState,
  updateModelType,
  clearPendingState,
} = require("../db");

require("dotenv").config();

const commands = ["reset", "change model", "cancel"];
const moderlsList = ["deepseek", "gemini", "together"];

const handlePostRequest = async (req, res) => {
  const body = req.body;
  // run start up functions, cleaners etc
  // try {
  //   await ensureTTLIndex();
  // } catch (error) {
  //   console.log(error);
  // }
  if (body.object === "page") {
    console.log("request recevied");
    body.entry.forEach(async (entry) => {
      const event = entry.messaging[0];
      const senderId = event.sender.id;
      if (event.message && event.message.text) {
        const text = event.message.text.toLowerCase();
        const matched = commands.some((command) => text.includes(command));
        const stateExists = await checkPendingState(senderId);

        if (text == "cancel") {
          console.log("Command detected :", text);
          await clearPendingState(senderId);
          sendMessage(senderId, "Your canceled pending changes.");
          return;
        }

        if (stateExists && stateExists.pending_action.type == "change") {
          if (moderlsList.some((model) => text.includes(model))) {
            await updateModelType(text);
            await clearPendingState(senderId);
            sendMessage(senderId, `${stateExists.successMessage} *${text}*!`);
            return;
          } else {
            sendMessage(senderId, stateExists.failMessage);
            return;
          }
        }

        if (stateExists && stateExists.pending_action.type == "image") {
          if (text) {
            const receivedMessage = event.message.text;
            sendPromt(
              senderId,
              receivedMessage,
              stateExists.pending_action.parameters.imageUrl
            );
            await clearPendingState(senderId);
          }
          return;
        }

        if (matched) {
          if (text == "reset") {
            console.log("Command detected :", text);
            await deleteUserContextsById(senderId);
            sendMessage(senderId, "Your chat context has been removed.");
            return;
          }
          if (text == "change model") {
            console.log("Command detected :", text);
            await setPendingState(senderId, "change", {});
            sendMessage(
              senderId,
              "Model you want to change to? type one from this Models list: Together, DeepSeek, Gemini."
            );
            return;
          }
        }
        const receivedMessage = event.message.text;
        sendPromt(senderId, receivedMessage);
      } else if (event.message.attachments) {
        event.message.attachments.forEach(async (attachment) => {
          if (attachment.type === "image") {
            await setPendingState(senderId, "image", {
              imageUrl: attachment.payload.url,
            });
            await insertUserContext({
              senderId,
              image: attachment.payload.url,
              type: "image",
            });
            sendMessage(senderId, "send your promt for the image");
          }
        });
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
};

const sendMessage = async (recipientId, messageText) => {
  // const AI_Response = await sendPromt(generationConfig, model, messageText);
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  // Split the response into chunks, each up to 2000 characters
  const chunkSize = 2000;
  const chunks = [];
  // Ensure the chunking respects the 2000 character limit
  for (let i = 0; i < messageText.length; i += chunkSize) {
    chunks.push(messageText.substring(i, i + chunkSize));
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

const createAIModel = (type, apiKey, hf, tg, senderId, image) => {
  if (type === "gemini") {
    console.log("using gemini");

    return {
      chat: async (prompt) => {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const generationConfig = {
          temperature: 1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: "text/plain",
        };

        const chatSession = model.startChat({ generationConfig, history: [] });
        const result = await chatSession.sendMessage(prompt);
        return result;
      },
    };
  }

  if (type === "deepseek") {
    console.log("using deepseek");
    return {
      chat: async (prompt) => {
        const together = new Together({ apiKey: tg });
        // only works with together models and deepseek
        const history = await getConversationHistory("8791587274222599");
        const messages = history
          .map((item) => [
            { role: "user", content: item.prompt },
            { role: "assistant", content: item.response },
          ])
          .flat();

        const response = await together.chat.completions.create({
          messages: [
            ...messages,
            {
              role: "user",
              content: prompt,
            },
          ],
          model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
        });

        console.log(response.choices[0].message.content);
        return response;
      },
    };
  }

  if (type === "together") {
    return {
      chat: async (prompt) => {
        const together = new Together({ apiKey: tg });

        // only works with together models and deepseek
        const history = await getConversationHistory("8791587274222599");
        const messages = history
          .map((item) => [
            { role: "user", content: item.prompt },
            { role: "assistant", content: item.response },
          ])
          .flat();

        const response = await together.chat.completions.create({
          model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
          max_tokens: 4096,
          temperature: 0.7,
          messages: [
            ...messages,
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                image && {
                  type: "image_url",
                  image_url: {
                    url: image,
                  },
                },
              ],
            },
          ],
        });

        return response;
      },
    };
  }

  throw new Error("Invalid AI model type");
};

async function sendPromt(senderId, prompt, image) {
  try {
    const model = await getModelType();
    const modelType = model.modelType || "deepseek"; // "deepseek" or "gemini","together"
    const apiKey = process.env.GEMINI_API_KEY;
    const hf = process.env.HF;
    const tg = process.env.TG;

    const aiModel = createAIModel(modelType, apiKey, hf, tg, senderId, image);

    const response = await aiModel.chat(prompt);
    let aiResponse;

    if (modelType == "deepseek") {
      console.log(response.choices[0].message.content);
      aiResponse = response.choices[0].message.content;
      sendMessage(
        senderId,
        `🧠 Model Type: ${modelType}\n\n📨 ${response.choices[0].message.content}`
      );
    }

    if (modelType == "gemini") {
      console.log(response.response.text());
      aiResponse = response.response.text();
      sendMessage(
        senderId,
        `🧠 Model Type: ${modelType}\n\n📨 ${response.response.text()}`
      );
    }

    if (modelType == "together") {
      console.log(response.choices[0].message.content);
      aiResponse = response.choices[0].message.content;
      sendMessage(
        senderId,
        `🧠 Model Type: ${modelType}\n\n📨 ${response.choices[0].message.content}`
      );
    }

    await insertUserContext({
      modelType,
      senderId,
      prompt: prompt,
      response: aiResponse,
      type: "text",
    });
  } catch (error) {
    console.log(error);
    sendMessage(senderId, "Something went wrong");
  }
}

module.exports = {
  handlePostRequest: handlePostRequest,
};

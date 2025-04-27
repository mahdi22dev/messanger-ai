const { default: axios } = require("axios");
const { GoogleGenAI } = require("@google/genai");
const { HfInference } = require("@huggingface/inference");
const { Together } = require("together-ai");
const {
  insertUserContext,
  deleteUserContextsById,
  getConversationHistory,
  getModelType,
  setPendingState,
  checkPendingState,
  updateModelType,
  clearPendingState,
} = require("../db");

require("dotenv").config();

const commands = ["reset", "change model", "cancel", "help"];
const moderlsList = ["deepseek", "gemini", "together"];

function getHelpMessage() {
  return `🤖 *AI Chat Bot Help* 🤖

🔹 *Basic Usage*:
- Just type your message to chat with the AI
- Send an image with a prompt to analyze images

🛠 *Commands*:
• *help* - Show this help message
• *reset* - Clear your conversation history
• *change model* - Switch between AI models (Together, DeepSeek, Gemini)
• *cancel* - Cancel any pending action
• *current model* - Returns the current model 

🖼 *Image Processing*:
1. Send an image attachment
2. The bot will ask for your prompt
3. Reply with your question about the image

🧠 *Available AI Models*:
- *Together*: Powerful general-purpose AI
- *DeepSeek*: Specialized for technical topics
- *Gemini*: Google's advanced AI model

📝 *Notes*:
- The bot remembers your conversation history
- You can change models anytime
- Image analysis works with all models

Type any command to get started or just ask a question!`;
}

const handlePostRequest = async (req, res) => {
  const body = req.body;
  if (body.object === "page") {
    body.entry.forEach(async (entry) => {
      const event = entry.messaging[0];
      const senderId = event.sender.id;

      if (event.message && event.message.text) {
        const text = event.message.text.toLowerCase();
        const matched = commands.some((command) => text.includes(command));
        const stateExists = await checkPendingState(senderId);

        if (text == "cancel") {
          await clearPendingState(senderId);
          sendMessage(senderId, "Your canceled pending changes.");
          return;
        }

        if (stateExists && stateExists.pending_action.type == "change") {
          if (moderlsList.some((model) => text == model)) {
            await updateModelType(text, senderId);
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
            await deleteUserContextsById(senderId);
            sendMessage(senderId, "Your chat context has been removed.");
            return;
          }
          if (text == "change model") {
            await setPendingState(senderId, "change", {});
            sendMessage(
              senderId,
              "Model you want to change to? type one from this Models list: Together, DeepSeek, Gemini."
            );
            return;
          }
          if (text == "help") {
            console.log("Command detected :", text);
            sendMessage(senderId, getHelpMessage());
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
    return {
      chat: async (prompt) => {
        const genAI = new GoogleGenAI({ apiKey: apiKey });
        const config = {
          responseMimeType: "text/plain",
          systemInstruction: [
            {
              text: `You are a helpful and friendly chatbot assistant designed for Facebook Messenger.\\n\\nMessenger does not support Markdown or HTML formatting. Therefore:\\n\\nDo not use bold **text**, italics _text_, headings #, or code blocks \`code\`.\\n\\nAll responses must be in plain text only.\\n\\nFor lists, use simple characters like:\\n\\n*, -, or numbers (1., 2.) for item markers.\\n\\nBe concise, conversational, and easy to understand.\\n\\nIf presenting steps or options, make them clearly visible using line breaks and list markers.\\n\\nEmojis are okay ✅ and can be used to add tone or clarity,\\n\\nHere’s what you can do:\\n* Check your account status\\n* View recent activity\\n* Contact support\\n\\nAlways adapt your tone to be helpful, polite, and human-friendly — just like you're chatting with a friend via Messenger.`,
            },
          ],
        };
        const model = "gemini-2.0-flash";
        const history = await getConversationHistory(senderId);

        const messages = history
          .map((item) => [
            {
              role: "user",
              parts: [{ text: item.prompt }],
            },
            {
              role: "model",
              parts: [{ text: item.response }],
            },
          ])
          .flat();

        const contents = [
          ...messages,
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ];

        const response = await genAI.models.generateContentStream({
          model,
          config,
          contents,
        });

        let fullResponse = "";
        for await (const chunk of response) {
          fullResponse += chunk.text;
        }

        return { response: { text: () => fullResponse } };
      },
    };
  }

  if (type === "deepseek") {
    return {
      chat: async (prompt) => {
        const together = new Together({ apiKey: tg });
        // only works with together models and deepseek
        const history = await getConversationHistory(senderId);

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
        const history = await getConversationHistory(senderId);
        const OldMessages = history
          .map((item) => [
            { role: "user", content: item.prompt },
            { role: "assistant", content: item.response },
          ])
          .flat();

        const messages = [
          ...OldMessages,
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...(image
                ? [
                    {
                      type: "image_url",
                      image_url: { url: image },
                    },
                  ]
                : []), // This ensures no `false` values
            ].filter(Boolean), // Extra safety to remove falsy values
          },
          {
            role: "system",
            content:
              "You are a helpful and friendly chatbot assistant designed for Facebook Messenger.\n\nMessenger does not support Markdown or HTML formatting. Therefore:\n\nDo not use bold **text**, italics _text_, headings #, or code blocks `code`.\n\nAll responses must be in plain text only.\n\nFor lists, use simple characters like:\n\n*, -, or numbers (1., 2.) for item markers.\n\nBe concise, conversational, and easy to understand.\n\nIf presenting steps or options, make them clearly visible using line breaks and list markers.\n\nEmojis are okay ✅ and can be used to add tone or clarity,\n\nHere’s what you can do:\n* Check your account status\n* View recent activity\n* Contact support\n\nAlways adapt your tone to be helpful, polite, and human-friendly — just like you're chatting with a friend via Messenger.",
          },
        ];
        console.log(
          messages.map((m) => {
            console.log(m);
          })
        );
        const response = await together.chat.completions.create({
          model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
          max_tokens: 4096,
          temperature: 0.7,
          messages: messages,
        });

        return response;
      },
    };
  }

  throw new Error("Invalid AI model type");
};

async function sendPromt(senderId, prompt, image) {
  try {
    const model = await getModelType(senderId);
    const modelType = model.modelType || "deepseek"; // default to deepseek
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

    // add user config if it doesn't exists
    if (model.modelType == null) {
      await updateModelType("deepseek", senderId);
    }
  } catch (error) {
    console.log(error);
    sendMessage(senderId, "Something went wrong");
  }
}

module.exports = {
  handlePostRequest: handlePostRequest,
};

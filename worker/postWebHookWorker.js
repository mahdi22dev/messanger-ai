import {
  insertUserContext,
  getConversationHistory,
  getModelType,
  updateModelType,
  checkPendingState,
  setPendingState,
  clearPendingState,
  deleteUserContextsById,
} from "../worker/dbWorker.js";

const commands = ["reset", "change model", "cancel", "help"];
const modelsList = ["deepseek", "gemini", "together"];

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
• *search this [query]* - Get top 10 web results
  
🔍 *New Search Commands*:
• *search this [query]* - Get top 10 web results with summaries
  Example: "search this best AI tools 2024"

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

const formatForMessenger = (text) => {
  return text
    .replace(/[*_`~#>]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\d+)\.\s*/g, "$1. ")
    .replace(/^\s*[-*]\s*/gm, "* ")
    .trim();
};

const sendMessage = async (recipientId, messageText, env) => {
  const PAGE_ACCESS_TOKEN = env.PAGE_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v22.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  const response = formatForMessenger(messageText);
  const chunkSize = 2000;
  for (let i = 0; i < response.length; i += chunkSize) {
    const chunk = response.substring(i, i + chunkSize);
    const messageData = {
      recipient: { id: recipientId },
      message: { text: chunk },
    };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageData),
    });
  }
};

const handlePostRequest = async (request, env, ctx) => {
  const body = await request.json();

  if (body.object === "page") {
    // Process entries and return immediately
    for (const entry of body.entry) {
      ctx.waitUntil(handleEntry(entry, env));
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
  return new Response("Not Found", { status: 404 });
};

async function handleEntry(entry, env) {
  const event = entry.messaging[0];
  const senderId = event.sender.id;

  if (event.message && event.message.text) {
    const text = event.message.text.toLowerCase();
    const matched = commands.some((command) => text.includes(command));
    const stateExists = await checkPendingState(senderId, env);

    if (text == "cancel") {
      await sendMessage(senderId, "Your canceled pending changes.", env);
      await clearPendingState(senderId, env);
      return;
    }

    if (stateExists && stateExists.pending_action.type == "change") {
      if (modelsList.some((model) => text == model)) {
        await updateModelType(text, senderId, env);
        await clearPendingState(senderId, env);
        await sendMessage(
          senderId,
          `${stateExists.successMessage} *${text}*!`,
          env,
        );
        return;
      } else {
        await sendMessage(senderId, stateExists.failMessage, env);
        return;
      }
    }

    if (stateExists && stateExists.pending_action.type == "image") {
      if (text) {
        await sendPromt(
          senderId,
          event.message.text,
          stateExists.pending_action.parameters.imageUrl,
          env,
        );
        await clearPendingState(senderId, env);
      }
      return;
    }

    if (matched) {
      if (text == "reset") {
        await sendMessage(senderId, "Your chat context has been removed.", env);
        await deleteUserContextsById(senderId, env);
        await clearPendingState(senderId, env);
        return;
      }
      if (text == "change model") {
        await sendMessage(
          senderId,
          "Model you want to change to? type one from this Models list: Together, DeepSeek, Gemini, Gemini-3-pro.",
          env,
        );
        await setPendingState(senderId, "change", {}, env);
        return;
      }
      if (text == "help") {
        await sendMessage(senderId, getHelpMessage(), env);
        return;
      }
    }
    await sendPromt(senderId, event.message.text, null, env);
  } else if (event.message.attachments) {
    for (const attachment of event.message.attachments) {
      if (attachment.type === "image") {
        await setPendingState(
          senderId,
          "image",
          {
            imageUrl: attachment.payload.url,
          },
          env,
        );
        await insertUserContext(
          {
            senderId,
            image: attachment.payload.url,
            type: "image",
          },
          env,
        );
        await sendMessage(senderId, "send your prompt for the image", env);
      }
    }
  }
}

async function callGeminiAPI(prompt, image, env) {
  const model = "gemini-2.0-flash"; // Or other supported model
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  // Simplified: If image exists, just send text prompt for now.
  // Full implementation requires handling image as inline data (base64)
  // or a file URI if supported by the REST API.

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callTogetherAPI(prompt, env) {
  const url = "https://api.together.xyz/v1/chat/completions";
  const payload = {
    model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 4096,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.TG}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

async function sendPromt(senderId, prompt, image, env) {
  try {
    const model = await getModelType(senderId, env);
    const modelType = model.modelType || "deepseek";

    let aiResponse;
    if (modelType === "gemini") {
      aiResponse = await callGeminiAPI(prompt, image, env);
    } else {
      // Default to Together/DeepSeek
      aiResponse = await callTogetherAPI(prompt, env);
    }

    await sendMessage(
      senderId,
      `🧠 Model Type: ${modelType}\n\n📨 ${aiResponse}`,
      env,
    );

    await insertUserContext(
      {
        modelType,
        senderId,
        prompt: prompt,
        response: aiResponse,
        image: image,
        type: "text",
      },
      env,
    );
  } catch (error) {
    console.error(error);
    await sendMessage(
      senderId,
      "Something went wrong during AI generation.",
      env,
    );
  }
}

export { handlePostRequest };

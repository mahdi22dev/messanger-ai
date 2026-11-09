import { handlePostRequest } from "./postWebHookWorker.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Root Endpoint
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        "This is the AI Chatbot Worker - Powered by Together AI, Gemini",
        { status: 200 }
      );
    }

    // Facebook Webhook Verification
    if (request.method === "GET" && url.pathname === "/webhook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      
      if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }
    
    // Webhook Event Handling
    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        return await handlePostRequest(request, env, ctx);
      } catch (err) {
        return new Response("Invalid Request", { status: 400 });
      }
    }

    
    return new Response("Not Found", { status: 404 });
  },
};

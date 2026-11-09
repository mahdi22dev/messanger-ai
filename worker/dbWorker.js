// dbWorker.js - Cloudflare Worker compatible MongoDB interface via Atlas Data API
// NOTE: This assumes MongoDB Atlas Data API is enabled for the cluster.

const DATA_API_URL = "unused";
const DB_NAME = "chatbot_db";

async function apiRequest(action, collection, data, env) {
  const response = await fetch(`${env.MONGODB_DATA_API_ENDPOINT}/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.MONGODB_DATA_API_KEY,
    },
    body: JSON.stringify({
      dataSource: "Cluster0",
      database: "chatbot_db",
      collection: collection,
      ...data,
    }),
  });
  return await response.json();
}

async function insertUserContext(userContext, env) {
  return await apiRequest("insertOne", "user_contexts", {
    document: { ...userContext, createdAt: new Date() },
  }, env);
}

async function getConversationHistory(senderId, limit = 10, env) {
  const result = await apiRequest("find", "user_contexts", {
    filter: { senderId },
    sort: { timestamp: -1 },
    limit,
  }, env);
  return (result.documents || []).reverse();
}

async function getModelType(senderId, env) {
  const result = await apiRequest("findOne", "config", {
    filter: { senderId },
  }, env);
  return result.document || { modelType: "deepseek" };
}

async function updateModelType(model, senderId, env) {
  return await apiRequest("updateOne", "config", {
    filter: { senderId },
    update: { $set: { modelType: model, updatedAt: new Date() } },
    upsert: true,
  }, env);
}

async function setPendingState(senderId, actionType, parameters, env) {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);
  return await apiRequest("updateOne", "conversation_states", {
    filter: { senderId },
    update: {
      $set: {
        current_state: "awaiting_confirmation",
        title: actionType == "change" ? "change model name" : "image propmt",
        failMessage:
          actionType == "change"
            ? "You already have a pending model change.\nPlease type the name of the model you want to switch to from the following list: Together, DeepSeek, Gemini.\nOr type 'cancel' to cancel the pending change."
            : "send your propmt for the image ",
        successMessage: `🎉 Model successfully updated to `,
        pending_action: {
          type: actionType,
          parameters,
        },
        createdAt: new Date(),
        expiresAt: { $date: expiry.toISOString() },
      },
    },
    upsert: true,
  }, env);
}

async function checkPendingState(senderId, env) {
  const result = await apiRequest("findOne", "conversation_states", {
    filter: {
      senderId,
      expiresAt: { $gt: { $date: new Date().toISOString() } },
    },
  }, env);
  return result.document;
}

async function clearPendingState(senderId, env) {
  return await apiRequest("deleteOne", "conversation_states", {
    filter: { senderId },
  }, env);
}

async function deleteUserContextsById(senderId, env) {
  return await apiRequest("deleteMany", "user_contexts", {
    filter: { senderId },
  }, env);
}

export {
  insertUserContext,
  getConversationHistory,
  getModelType,
  updateModelType,
  setPendingState,
  checkPendingState,
  clearPendingState,
  deleteUserContextsById,
};



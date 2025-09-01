const { MongoClient, ServerApiVersion } = require("mongodb");

// Configuration - should ideally come from environment variables
const config = {
  mongoUri: process.env.MONGODB_URL,
  dbName: "chatbot_db",
  collectionName: "user_contexts",
  poolSize: 50,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

// Create a cached connection to reuse
let client;
let isConnected = false;

async function getMongoClient() {
  if (isConnected && client) {
    return client;
  }

  try {
    client = new MongoClient(config.mongoUri, {
      serverApi: config.serverApi,
      maxPoolSize: config.poolSize, // Connection pool size
      minPoolSize: 5, // Minimum number of connections to maintain
      maxIdleTimeMS: 10000, // How long a connection can be idle before being closed
      connectTimeoutMS: 5000, // Timeout for connection attempts
      socketTimeoutMS: 30000, // Timeout for socket operations
    });
    await client.connect();
    isConnected = true;
    return client;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

async function insertUserContext(userContext) {
  let client;
  try {
    client = await getMongoClient();
    const db = client.db(config.dbName);
    const collection = db.collection(config.collectionName);

    const document = {
      ...userContext,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(document);
    return result;
  } catch (error) {
    console.error("Error inserting user context:", error);
    throw error;
  }
}

async function deleteUserContextsById(senderId) {
  let client;
  try {
    client = await getMongoClient();
    const db = client.db(config.dbName);
    const collection = db.collection(config.collectionName);
    const result = await collection.deleteMany({ senderId: senderId });
    return result;
  } catch (error) {
    console.error("Error deleting user contexts:", error);
    throw error;
  }
}

async function getConversationHistory(senderId, limit = 10) {
  try {
    client = await getMongoClient();
    const db = client.db(config.dbName);
    const collection = db.collection(config.collectionName);
    const history = await collection
      .find({ senderId })
      .sort({ timestamp: -1 }) // Newest first
      .limit(limit)
      .toArray();
    return history.reverse(); // Return in chronological order
  } catch (err) {
    console.error("Error fetching conversation history:", err);
    return [];
  }
}

async function getModelType(senderId) {
  let client;
  try {
    client = await getMongoClient();
    const db = client.db(config.dbName);
    const collection = db.collection("config");
    const model = await collection.findOne({ senderId: senderId });
    return model || "deepseek"; // Return in chronological order
  } catch (error) {
    console.error("Error Find ModelType:");
    throw error;
  }
}
async function updateModelType(model, senderId) {
  let client;
  try {
    client = await getMongoClient();
    const db = client.db(config.dbName);
    const collection = db.collection("config");
    const result = await collection.findOneAndUpdate(
      { senderId: senderId },
      { $set: { modelType: model, updatedAt: new Date() } },
      {
        returnDocument: "after",
        upsert: true,
      }
    );
    console.log("result:", result);
    return result;
  } catch (error) {
    console.error("Error Find ModelType:");
    throw error;
  }
}

async function setPendingState(senderId, actionType, parameters) {
  const client = await getMongoClient();
  const db = client.db(config.dbName);
  const collection = db.collection("conversation_states");

  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15); // 15-minute timeout
  await collection.updateOne(
    { senderId },
    {
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
        expiresAt: expiry,
      },
    },
    { upsert: true }
  );
}

async function checkPendingState(senderId) {
  const client = await getMongoClient();
  const db = client.db(config.dbName);
  const collection = db.collection("conversation_states");

  return await collection.findOne({
    senderId,
    expiresAt: { $gt: new Date() },
  });
}

async function clearPendingState(senderId) {
  const client = await getMongoClient();
  const db = client.db(config.dbName);
  const collection = db.collection("conversation_states");

  await collection.deleteOne({ senderId });
}

// Auto-create TTL index on first run
async function ensureTTLIndex() {
  const client = await getMongoClient();
  const db = client.db(config.dbName);
  const collection = db.collection("conversation_states");

  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

// async function closeConnection() {
//   if (client && isConnected) {
//     await client.close();
//     isConnected = false;
//     console.log("MongoDB connection closed");
//   }
// }

module.exports = {
  insertUserContext,
  getMongoClient,
  deleteUserContextsById,
  getConversationHistory,
  setPendingState,
  checkPendingState,
  clearPendingState,
  ensureTTLIndex,
  getModelType,
  updateModelType,
};

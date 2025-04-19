require("dotenv").config();

const MetaVerificationProccess = (req, res) => {
  console.log("verification request");
  try {
    // Parse the query params
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  MetaVerificationProccess,
};

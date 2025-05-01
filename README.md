# Messenger AI Chatbot

This repository contains an AI-powered chatbot designed for integration with Facebook Messenger. The chatbot leverages the **Together.AI** and **Gemeni API** to deliver intelligent and interactive conversation experiences.

---

## Features

- **AI-Powered Conversations**: Provides intelligent responses using advanced AI models.
- **Messenger Integration**: Seamlessly integrates with Facebook Messenger to interact with users.
- **Customizable**: Easily adaptable to specific use cases or industries.
- **Lightweight and Efficient**: Developed primarily in JavaScript for optimized performance.

---

## Installation

Follow these steps to set up the chatbot on your local environment:

### Prerequisites

1. **Node.js and npm**: Ensure you have Node.js (v14 or higher) and npm installed.  
   [Download Node.js](https://nodejs.org/)
2. **Facebook App**: Create a Facebook application and set up Messenger integration.
3. **API Keys**: Obtain API keys for:
   - Together.AI
   - Gemeni API

### Steps

1. **Clone the Repository**  
   ```bash
   git clone https://github.com/mahdi22dev/messangerAi.git
   cd messangerAi
   ```

2. **Install Dependencies**  
   Install the required Node.js packages using npm:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**  
   Create a `.env` file in the root directory and add the following:
   ```env
   TOGETHER_AI_API_KEY=your-together-ai-api-key
   GEMENI_API_KEY=your-gemeni-api-key
   FB_PAGE_ACCESS_TOKEN=your-facebook-page-access-token
   FB_VERIFY_TOKEN=your-facebook-verify-token
   ```

4. **Start the Application**  
   Run the chatbot locally:
   ```bash
   npm start
   ```

5. **Deploy**  
   Optionally, deploy the chatbot to a cloud platform of your choice for production use.

---

## 🤖 *AI Chat Bot Help* 🤖

### 🔹 *Basic Usage*:
- Just type your message to chat with the AI.
- Send an image with a prompt to analyze images.

### 🛠 *Commands*:
- **help** - Show this help message.
- **reset** - Clear your conversation history.
- **change model** - Switch between AI models (Together, DeepSeek, Gemini).
- **cancel** - Cancel any pending action.
- **current model** - Returns the current model.
- **search this [query]** - Get top 10 web results.

### 🔍 *New Search Commands*:
- **search this [query]** - Get top 10 web results with summaries.  
  Example: "search this best AI tools 2024".

### 🖼 *Image Processing*:
1. Send an image attachment.
2. The bot will ask for your prompt.
3. Reply with your question about the image.

### 🧠 *Available AI Models*:
- **Together**: Powerful general-purpose AI.
- **DeepSeek**: Specialized for technical topics.
- **Gemini**: Google's advanced AI model.

### 📝 *Notes*:
- The bot remembers your conversation history.
- You can change models anytime.
- Image analysis works with all models.

---

Type any command to get started or just ask a question!

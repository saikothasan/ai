export interface Env {
  AI: any
  TELEGRAM_BOT_TOKEN: string // Add Telegram bot token to environment variables
}

const WORKER_URL = "https://ai.example.com" // Replace with your worker URL

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Handle Telegram webhook
    if (path === "/telegram-webhook") {
      return handleTelegramWebhook(request, env)
    }

    // Handle image generation
    if (path === "/api/generate-image") {
      return handleImageGeneration(request, env)
    }

    // Handle chat
    if (path === "/api/chat") {
      return handleChat(request, env)
    }

    // Return simple HTML interface for testing
    return new Response(getIndexHtml(), {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    })
  },
}

// Telegram bot handler
async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const update = await request.json()

    // Check if this is a message update
    if (!update.message) {
      return new Response("OK", { status: 200 })
    }

    const chatId = update.message.chat.id
    const messageText = update.message.text || ""

    // Check if this is a command
    if (messageText.startsWith("/image") || messageText.startsWith("/img")) {
      // Extract the prompt from the command
      const prompt = messageText.replace(/^\/image\s+|^\/img\s+/, "").trim()

      if (!prompt) {
        await sendTelegramMessage(
          env,
          chatId,
          "Please provide a description for the image. Example: /image a cat in space",
        )
        return new Response("OK", { status: 200 })
      }

      // Send a "generating" message
      await sendTelegramMessage(env, chatId, "🎨 Generating your image...")

      // Generate the image
      try {
        const imageResponse = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", { prompt })

        // Send the image back to the user
        await sendTelegramPhoto(env, chatId, imageResponse, prompt)
      } catch (error) {
        await sendTelegramMessage(env, chatId, `Sorry, I couldn't generate that image: ${error}`)
      }
    } else if (messageText.startsWith("/start")) {
      // Welcome message
      await sendTelegramMessage(
        env,
        chatId,
        "👋 Hello! I'm your AI assistant. I can chat with you or generate images.\n\n" +
          "To chat, just send me a message.\n" +
          "To generate an image, use the /image command followed by a description.\n\n" +
          "Example: /image a futuristic city with flying cars",
      )
    } else if (messageText.startsWith("/help")) {
      // Help message
      await sendTelegramMessage(
        env,
        chatId,
        "🤖 *AI Assistant Help*\n\n" +
          "*Commands:*\n" +
          "/start - Start the bot\n" +
          "/help - Show this help message\n" +
          "/image [description] - Generate an image based on your description\n" +
          "/img [description] - Short version of the image command\n\n" +
          "For chat, simply send any message that doesn't start with a command.",
        "Markdown",
      )
    } else {
      // This is a regular chat message
      // Send a "thinking" message
      await sendTelegramMessage(env, chatId, "🤔 Thinking...")

      // Process the chat message
      try {
        const messages = [
          { role: "system", content: "You are a helpful AI assistant." },
          { role: "user", content: messageText },
        ]

        const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages,
          max_tokens: 2048, // Set max_tokens as requested
        })

        // Send the response back to the user
        await sendTelegramMessage(env, chatId, response.response || "I don't know what to say.")
      } catch (error) {
        await sendTelegramMessage(env, chatId, `Sorry, I couldn't process that message: ${error}`)
      }
    }

    return new Response("OK", { status: 200 })
  } catch (error) {
    return new Response(`Error processing Telegram webhook: ${error}`, { status: 500 })
  }
}

// Helper function to send a message to Telegram
async function sendTelegramMessage(
  env: Env,
  chatId: string | number,
  text: string,
  parseMode?: "Markdown" | "HTML",
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`

  const body: any = {
    chat_id: chatId,
    text: text,
  }

  if (parseMode) {
    body.parse_mode = parseMode
  }

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

// Helper function to send a photo to Telegram
async function sendTelegramPhoto(
  env: Env,
  chatId: string | number,
  imageData: ArrayBuffer,
  caption?: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`

  const formData = new FormData()
  formData.append("chat_id", chatId.toString())

  // Convert ArrayBuffer to Blob
  const blob = new Blob([imageData], { type: "image/png" })
  formData.append("photo", blob, "generated-image.png")

  if (caption) {
    formData.append("caption", caption)
  }

  await fetch(url, {
    method: "POST",
    body: formData,
  })
}

async function handleImageGeneration(request: Request, env: Env): Promise<Response> {
  // Only accept POST requests for image generation
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  try {
    // Parse the request body to get the prompt
    const { prompt } = await request.json()

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 })
    }

    // Call the Stability AI model to generate an image
    const response = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", { prompt })

    // Return the generated image
    return new Response(response, {
      headers: {
        "content-type": "image/png",
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: `Error generating image: ${error}` }), { status: 500 })
  }
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  // Only accept POST requests for chat
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  try {
    // Parse the request body to get the message
    const { message } = await request.json()

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), { status: 400 })
    }

    // Set up messages for the chat
    const messages = [
      { role: "system", content: "You are a helpful AI assistant." },
      { role: "user", content: message },
    ]

    // Call the Llama model for chat with streaming enabled and max_tokens set
    const stream = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages,
      stream: true,
      max_tokens: 2048, // Set max_tokens as requested
    })

    // Return the streaming response
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: `Error in chat: ${error}` }), { status: 500 })
  }
}

function getIndexHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Assistant | Image Generation & Chat</title>
  <meta name="description" content="AI-powered image generation and chat assistant using Stability AI and Llama models">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${WORKER_URL}">
  <meta property="og:title" content="AI Assistant | Image Generation & Chat">
  <meta property="og:description" content="AI-powered image generation and chat assistant using Stability AI and Llama models">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${WORKER_URL}">
  <meta property="og:title" content="AI Assistant | Image Generation & Chat">
  <meta property="og:description" content="AI-powered image generation and chat assistant using Stability AI and Llama models">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --primary: #6366f1;
      --primary-light: #818cf8;
      --primary-dark: #4f46e5;
      --secondary: #10b981;
      --secondary-light: #34d399;
      --secondary-dark: #059669;
      --accent: #f43f5e;
      --accent-light: #fb7185;
      --accent-dark: #e11d48;
      --background: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-light: #64748b;
      --text-lighter: #94a3b8;
      --border: #e2e8f0;
      --shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      --radius: 1rem;
      --radius-sm: 0.5rem;
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      --max-width: 900px;
    }
    
    .dark {
      --primary: #818cf8;
      --primary-light: #a5b4fc;
      --primary-dark: #6366f1;
      --secondary: #34d399;
      --secondary-light: #6ee7b7;
      --secondary-dark: #10b981;
      --accent: #fb7185;
      --accent-light: #fda4af;
      --accent-dark: #f43f5e;
      --background: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-light: #cbd5e1;
      --text-lighter: #94a3b8;
      --border: #334155;
      --shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
      --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px 0 rgba(0, 0, 0, 0.1);
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: var(--background);
      color: var(--text);
      line-height: 1.6;
      padding: 0;
      margin: 0;
      min-height: 100vh;
      transition: var(--transition);
    }
    
    header {
      background: linear-gradient(135deg, var(--primary), var(--primary-dark), var(--accent-dark));
      background-size: 200% 200%;
      animation: gradientAnimation 15s ease infinite;
      color: white;
      padding: 2rem 0;
      text-align: center;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }
    
    @keyframes gradientAnimation {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    
    header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 60%);
      transform: rotate(30deg);
      pointer-events: none;
    }
    
    header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      position: relative;
      z-index: 1;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    header p {
      font-size: 1.1rem;
      opacity: 0.9;
      max-width: 600px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }
    
    .theme-toggle {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      transition: var(--transition);
      backdrop-filter: blur(5px);
      z-index: 10;
    }
    
    .theme-toggle:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }
    
    main {
      max-width: var(--max-width);
      margin: 2rem auto;
      padding: 0 1rem;
      position: relative;
    }
    
    .card {
      background-color: var(--card-bg);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 2rem;
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }
    
    .card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 5px;
      background: linear-gradient(90deg, var(--primary), var(--accent));
    }
    
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }
    
    h2 {
      font-size: 1.75rem;
      margin-bottom: 1.5rem;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      position: relative;
    }
    
    h2 svg {
      width: 1.5rem;
      height: 1.5rem;
    }
    
    form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    
    label {
      font-weight: 600;
      margin-bottom: 0.25rem;
      display: block;
      color: var(--text);
    }
    
    input, textarea, select {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background-color: var(--card-bg);
      color: var(--text);
      font-family: inherit;
      font-size: 1rem;
      transition: var(--transition);
      box-shadow: var(--shadow-sm);
    }
    
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    
    textarea {
      resize: vertical;
      min-height: 120px;
    }
    
    button {
      background-color: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      padding: 0.875rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      position: relative;
      overflow: hidden;
      z-index: 1;
    }
    
    button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: var(--transition);
      z-index: -1;
    }
    
    button:hover::before {
      left: 100%;
      transition: 0.75s;
    }
    
    button:hover {
      background-color: var(--primary-dark);
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    button:active {
      transform: translateY(0);
    }
    
    button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    
    button:disabled::before {
      display: none;
    }
    
    .button-secondary {
      background-color: var(--secondary);
    }
    
    .button-secondary:hover {
      background-color: var(--secondary-dark);
    }
    
    .result {
      margin-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .result-image {
      width: 100%;
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow);
      max-height: 400px;
      object-fit: contain;
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    .chat-messages {
      margin-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 500px;
      overflow-y: auto;
      padding-right: 0.5rem;
      scroll-behavior: smooth;
    }
    
    .chat-messages::-webkit-scrollbar {
      width: 6px;
    }
    
    .chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .chat-messages::-webkit-scrollbar-thumb {
      background-color: var(--text-lighter);
      border-radius: 20px;
    }
    
    .message {
      padding: 1rem;
      border-radius: var(--radius-sm);
      max-width: 85%;
      position: relative;
      animation: fadeIn 0.3s ease-in;
      box-shadow: var(--shadow-sm);
      transition: var(--transition);
    }
    
    .message:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }
    
    .message.user {
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 0;
    }
    
    .message.user::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: -10px;
      width: 0;
      height: 0;
      border-left: 10px solid var(--primary-dark);
      border-top: 10px solid transparent;
    }
    
    .message.assistant {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      align-self: flex-start;
      border-bottom-left-radius: 0;
    }
    
    .message.assistant::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: -10px;
      width: 0;
      height: 0;
      border-right: 10px solid var(--border);
      border-top: 10px solid transparent;
    }
    
    .message.image {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      align-self: flex-start;
      max-width: 100%;
      padding: 0.75rem;
      border-bottom-left-radius: 0;
    }
    
    .message.image::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: -10px;
      width: 0;
      height: 0;
      border-right: 10px solid var(--border);
      border-top: 10px solid transparent;
    }
    
    .message.image img {
      width: 100%;
      border-radius: calc(var(--radius-sm) - 0.25rem);
      transition: var(--transition);
    }
    
    .message.image img:hover {
      transform: scale(1.02);
    }
    
    .message-time {
      font-size: 0.75rem;
      color: var(--text-lighter);
      margin-top: 0.5rem;
      text-align: right;
    }
    
    .message.user .message-time {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin: 1rem 0;
      color: var(--text-light);
      background-color: var(--card-bg);
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-sm);
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }
    
    .loading-spinner {
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid rgba(99, 102, 241, 0.2);
      border-radius: 50%;
      border-top-color: var(--primary);
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    .error {
      color: var(--accent);
      margin-top: 0.75rem;
      font-size: 0.875rem;
      background-color: rgba(244, 63, 94, 0.1);
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      border-left: 3px solid var(--accent);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .error svg {
      flex-shrink: 0;
    }
    
    footer {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-light);
      font-size: 0.875rem;
      border-top: 1px solid var(--border);
      margin-top: 3rem;
      background-color: var(--card-bg);
    }
    
    .fade-in {
      animation: fadeIn 0.5s ease-in;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.75rem 1.25rem;
      border-radius: var(--radius-sm);
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      align-self: flex-start;
      margin-top: 0.5rem;
      box-shadow: var(--shadow-sm);
    }
    
    .typing-dot {
      width: 0.5rem;
      height: 0.5rem;
      background-color: var(--primary);
      border-radius: 50%;
      animation: typingAnimation 1.4s infinite ease-in-out;
    }
    
    .typing-dot:nth-child(1) {
      animation-delay: 0s;
    }
    
    .typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typingAnimation {
      0%, 60%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-0.5rem);
      }
    }
    
    .mode-selector {
      margin-bottom: 1.5rem;
      position: relative;
    }
    
    .mode-tabs {
      display: flex;
      background-color: rgba(99, 102, 241, 0.1);
      border-radius: var(--radius-sm);
      padding: 0.25rem;
      position: relative;
      overflow: hidden;
    }
    
    .mode-tab {
      flex: 1;
      text-align: center;
      padding: 0.75rem 1rem;
      cursor: pointer;
      position: relative;
      z-index: 1;
      transition: var(--transition);
      font-weight: 500;
      color: var(--text-light);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    
    .mode-tab.active {
      color: white;
    }
    
    .mode-tab-slider {
      position: absolute;
      top: 0.25rem;
      left: 0.25rem;
      bottom: 0.25rem;
      width: calc(50% - 0.5rem);
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      border-radius: calc(var(--radius-sm) - 0.25rem);
      transition: var(--transition);
      z-index: 0;
    }
    
    .mode-tab-slider.chat {
      left: 0.25rem;
    }
    
    .mode-tab-slider.image {
      left: calc(50% + 0.25rem);
    }
    
    .download-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      background-color: var(--secondary);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      margin-top: 0.75rem;
      transition: var(--transition);
    }
    
    .download-button:hover {
      background-color: var(--secondary-dark);
      transform: translateY(-2px);
    }
    
    .download-button:active {
      transform: translateY(0);
    }
    
    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .suggestion {
      background-color: rgba(99, 102, 241, 0.1);
      color: var(--primary);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 2rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: var(--transition);
    }
    
    .suggestion:hover {
      background-color: var(--primary);
      color: white;
      transform: translateY(-2px);
    }
    
    .clear-chat {
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      background: transparent;
      border: none;
      color: var(--text-light);
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 50%;
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .clear-chat:hover {
      color: var(--accent);
      background-color: rgba(244, 63, 94, 0.1);
      transform: rotate(15deg);
    }
    
    /* Telegram bot section */
    .telegram-section {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px dashed var(--border);
    }
    
    .telegram-info {
      background-color: rgba(99, 102, 241, 0.05);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    
    .telegram-info h3 {
      color: var(--primary);
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .telegram-info p {
      margin-bottom: 0.75rem;
    }
    
    .telegram-info ul {
      margin-left: 1.5rem;
      margin-bottom: 0.75rem;
    }
    
    .telegram-info code {
      background-color: rgba(99, 102, 241, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-family: monospace;
      font-size: 0.9em;
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      header h1 {
        font-size: 2rem;
      }
      
      header p {
        font-size: 1rem;
      }
      
      .card {
        padding: 1.5rem;
      }
      
      h2 {
        font-size: 1.5rem;
      }
      
      button {
        padding: 0.75rem 1.25rem;
      }
      
      .chat-messages {
        max-height: 400px;
      }
    }
    
    @media (max-width: 640px) {
      header h1 {
        font-size: 1.75rem;
      }
      
      header p {
        font-size: 0.875rem;
      }
      
      .card {
        padding: 1.25rem;
      }
      
      h2 {
        font-size: 1.25rem;
        margin-bottom: 1.25rem;
      }
      
      .mode-tab {
        padding: 0.625rem 0.5rem;
        font-size: 0.875rem;
      }
      
      .message {
        max-width: 90%;
      }
    }
  </style>
</head>
<body>
  <button id="theme-toggle" class="theme-toggle" aria-label="Toggle dark mode">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sun-icon">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="moon-icon" style="display: none;">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  </button>

  <header>
    <h1>AI Assistant</h1>
    <p>Chat and generate stunning images with advanced AI models</p>
  </header>
  
  <main>
    <section class="card">
      <button id="clear-chat" class="clear-chat" aria-label="Clear chat history">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"></path>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
      </button>
      
      <h2>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        AI Assistant
      </h2>
      
      <div id="chat-messages" class="chat-messages">
        <div class="message assistant fade-in">
          <div>Hello! I'm your AI assistant. I can chat with you or generate images. How can I help you today?</div>
          <div class="message-time">Just now</div>
        </div>
      </div>
      
      <div class="suggestions">
        <button class="suggestion" data-prompt="Tell me about artificial intelligence">Tell me about AI</button>
        <button class="suggestion" data-prompt="Generate an image of a futuristic city">Futuristic city image</button>
        <button class="suggestion" data-prompt="What can you help me with?">What can you do?</button>
        <button class="suggestion" data-prompt="Generate an image of a cat in space">Space cat image</button>
      </div>
      
      <form id="ai-form">
        <div class="mode-selector">
          <div class="mode-tabs">
            <div class="mode-tab active" data-mode="chat">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Chat
            </div>
            <div class="mode-tab" data-mode="image">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Generate Image
            </div>
            <div class="mode-tab-slider chat"></div>
          </div>
          <input type="hidden" id="mode" name="mode" value="chat">
        </div>
        
        <div>
          <label for="prompt">Your message</label>
          <textarea id="prompt" name="prompt" placeholder="Ask me anything..." required></textarea>
        </div>
        
        <button type="submit" id="submit-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span id="button-text">Send Message</span>
        </button>
        
        <div id="loading" class="loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span id="loading-text">Thinking...</span>
        </div>
        
        <div id="error" class="error" style="display: none;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span id="error-text">An error occurred. Please try again.</span>
        </div>
      </form>
      
      <div class="telegram-section">
        <div class="telegram-info">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2l-19 19"></path>
              <path d="M21.5 2l-9 22-3-11-8-8z"></path>
            </svg>
            Telegram Bot Integration
          </h3>
          <p>This AI Assistant is also available as a Telegram bot! You can chat and generate images directly from Telegram.</p>
          <p><strong>Commands:</strong></p>
          <ul>
            <li><code>/start</code> - Start the bot</li>
            <li><code>/help</code> - Show help information</li>
            <li><code>/image [description]</code> - Generate an image</li>
            <li><code>/img [description]</code> - Short version of the image command</li>
          </ul>
          <p>For regular chat, simply send a message to the bot.</p>
        </div>
      </div>
    </section>
  </main>
  
  <footer>
    <p>Powered by Cloudflare Workers, Stability AI, and Meta's Llama 3.3</p>
    <p>&copy; ${new Date().getFullYear()} - All rights reserved</p>
  </footer>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Theme toggle
      const themeToggle = document.getElementById('theme-toggle');
      const sunIcon = document.querySelector('.sun-icon');
      const moonIcon = document.querySelector('.moon-icon');
      
      // Check for saved theme preference or use system preference
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark');
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
      
      themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        if (isDark) {
          sunIcon.style.display = 'none';
          moonIcon.style.display = 'block';
        } else {
          sunIcon.style.display = 'block';
          moonIcon.style.display = 'none';
        }
      });
      
      // Elements
      const aiForm = document.getElementById('ai-form');
      const modeInput = document.getElementById('mode');
      const modeTabs = document.querySelectorAll('.mode-tab');
      const modeTabSlider = document.querySelector('.mode-tab-slider');
      const promptInput = document.getElementById('prompt');
      const submitButton = document.getElementById('submit-button');
      const buttonText = document.getElementById('button-text');
      const loading = document.getElementById('loading');
      const loadingText = document.getElementById('loading-text');
      const error = document.getElementById('error');
      const errorText = document.getElementById('error-text');
      const chatMessages = document.getElementById('chat-messages');
      const clearChatButton = document.getElementById('clear-chat');
      const suggestions = document.querySelectorAll('.suggestion');
      
      // Mode tabs
      modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const mode = tab.dataset.mode;
          
          // Update active tab
          modeTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // Update slider position
          modeTabSlider.className = \`mode-tab-slider ${mode}`

  // Update hidden input
  modeInput.value = mode

  // Update button text and placeholder
  buttonText.textContent = mode === "chat" ? "Send Message" : "Generate Image"
  promptInput.placeholder = mode === "chat" ? "Ask me anything..." : "Describe the image you want to generate..."
}
)
\
      })

// Suggestion buttons
suggestions.forEach((suggestion) =>
{
  suggestion.addEventListener("click", () => {
    const prompt = suggestion.dataset.prompt
    promptInput.value = prompt
    promptInput.focus()

    // If it's an image suggestion, switch to image mode
    if (prompt.toLowerCase().includes("image") || prompt.toLowerCase().includes("generate")) {
      modeTabs[1].click()
    }
  })
}
)

// Clear chat
clearChatButton.addEventListener("click", () =>
{
  // Keep only the first welcome message
  const welcomeMessage = chatMessages.firstElementChild
  chatMessages.innerHTML = ""
  chatMessages.appendChild(welcomeMessage)
}
)

// Form submission
aiForm.addEventListener("submit", async (e) =>
{
  e.preventDefault()

  const mode = modeInput.value
  const prompt = promptInput.value.trim()

  if (!prompt) return

  // Show loading state
  submitButton.disabled = true
  loading.style.display = "flex"
  loadingText.textContent = mode === "chat" ? "Thinking..." : "Generating image..."
  error.style.display = "none"

  // Add user message to chat with timestamp
  addMessage(prompt, "user")
  promptInput.value = ""

  try {
    if (mode === "chat") {
      await handleChatRequest(prompt)
    } else {
      await handleImageRequest(prompt)
    }
  } catch (err) {
    console.error(`Error in ${mode} request:`, err)
    errorText.textContent =
      err.message || `Failed to ${mode === "chat" ? "get response" : "generate image"}. Please try again.`
    error.style.display = "flex"
  } finally {
    submitButton.disabled = false
    loading.style.display = "none"
    chatMessages.scrollTop = chatMessages.scrollHeight
  }
}
)

// Handle chat request
async
function handleChatRequest(message) {
  // Create typing indicator
  const typingIndicator = document.createElement("div")
  typingIndicator.className = "typing-indicator"
  typingIndicator.innerHTML =
    '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>'
  chatMessages.appendChild(typingIndicator)
  chatMessages.scrollTop = chatMessages.scrollHeight

  // Create a new message element for the assistant's response
  const assistantMessage = document.createElement("div")
  assistantMessage.classList.add("message", "assistant", "fade-in")
  assistantMessage.style.display = "none" // Hide initially

  try {
    // Fetch the streaming response
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to get response")
    }

    // Process the streaming response
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let responseText = ""

    // Remove typing indicator and show the message element
    chatMessages.removeChild(typingIndicator)

    // Create message content div
    const messageContent = document.createElement("div")
    assistantMessage.appendChild(messageContent)

    // Create timestamp div
    const messageTime = document.createElement("div")
    messageTime.className = "message-time"
    messageTime.textContent = getFormattedTime()
    assistantMessage.appendChild(messageTime)

    assistantMessage.style.display = "block"
    chatMessages.appendChild(assistantMessage)

    // Read the stream
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      // Decode the chunk and update the UI
      const chunk = decoder.decode(value, { stream: true })

      // Parse SSE format
      const lines = chunk.split(/\\r?\\n/)
      for (const line of lines) {
        if (line.startsWith("data:")) {
          try {
            const data = line.substring(5).trim()
            if (data === "[DONE]") continue

            // Try to parse as JSON
            try {
              const jsonData = JSON.parse(data)
              if (jsonData.response) {
                responseText += jsonData.response
              }
            } catch (parseError) {
              // If not JSON, just append the data
              responseText += data
            }

            // Update the message content
            messageContent.textContent = responseText
            chatMessages.scrollTop = chatMessages.scrollHeight
          } catch (e) {
            console.error("Error parsing SSE data:", e)
          }
        }
      }
    }

    // If no text was received, show a fallback message
    if (!responseText.trim()) {
      messageContent.textContent = "I'm sorry, I couldn't generate a response. Please try again."
    }
  } catch (error) {
    // Remove typing indicator if it exists
    if (chatMessages.contains(typingIndicator)) {
      chatMessages.removeChild(typingIndicator)
    }
    throw error
  }
}

// Handle image request
async function handleImageRequest(prompt) {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to generate image")
    }

    const blob = await response.blob()
    const imageUrl = URL.createObjectURL(blob)

    // Create image message container
    const imageContainer = document.createElement("div")
    imageContainer.className = "message image fade-in"

    // Create image element
    const img = document.createElement("img")
    img.src = imageUrl
    img.alt = "Generated image: " + prompt
    img.className = "result-image"

    // Create download button
    const downloadButton = document.createElement("button")
    downloadButton.className = "download-button"
    downloadButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Image
          `

    // Create timestamp
    const messageTime = document.createElement("div")
    messageTime.className = "message-time"
    messageTime.textContent = getFormattedTime()

    // Add download functionality
    downloadButton.addEventListener("click", () => {
      const a = document.createElement("a")
      a.href = imageUrl
      a.download = "generated-image.png"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    })

    // Add elements to container
    imageContainer.appendChild(img)
    imageContainer.appendChild(downloadButton)
    imageContainer.appendChild(messageTime)

    // Add to chat
    chatMessages.appendChild(imageContainer)
    chatMessages.scrollTop = chatMessages.scrollHeight
  } catch (error) {
    throw error
  }
}

// Helper function to add messages to the chat
function addMessage(text, sender) {
  const messageElement = document.createElement("div")
  messageElement.classList.add("message", sender, "fade-in")

  // Create message content
  const messageContent = document.createElement("div")
  messageContent.textContent = text
  messageElement.appendChild(messageContent)

  // Create timestamp
  const messageTime = document.createElement("div")
  messageTime.className = "message-time"
  messageTime.textContent = getFormattedTime()
  messageElement.appendChild(messageTime)

  chatMessages.appendChild(messageElement)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Helper function to get formatted time
function getFormattedTime() {
  const now = new Date()
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Focus input on page load
promptInput.focus()
})
</script>
</body>
</html>`
}


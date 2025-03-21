export interface Env {
  AI: any
}

const WORKER_URL = "https://chat.oax.workers.dev" // Replace with your worker URL

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

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

    // Call the Llama model for chat with streaming enabled
    const stream = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages,
      stream: true,
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --primary: #4f46e5;
      --primary-dark: #4338ca;
      --secondary: #10b981;
      --secondary-dark: #059669;
      --background: #f9fafb;
      --card-bg: #ffffff;
      --text: #1f2937;
      --text-light: #6b7280;
      --border: #e5e7eb;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --radius: 0.5rem;
      --transition: all 0.2s ease;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --primary: #6366f1;
        --primary-dark: #4f46e5;
        --secondary: #10b981;
        --secondary-dark: #059669;
        --background: #111827;
        --card-bg: #1f2937;
        --text: #f9fafb;
        --text-light: #d1d5db;
        --border: #374151;
        --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
      }
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: var(--background);
      color: var(--text);
      line-height: 1.6;
      padding: 0;
      margin: 0;
      min-height: 100vh;
    }
    
    header {
      background: linear-gradient(to right, var(--primary), var(--primary-dark));
      color: white;
      padding: 1.5rem 0;
      text-align: center;
      box-shadow: var(--shadow);
    }
    
    header h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    
    header p {
      font-size: 1rem;
      opacity: 0.9;
      max-width: 600px;
      margin: 0 auto;
    }
    
    main {
      max-width: 1200px;
      margin: 2rem auto;
      padding: 0 1rem;
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    
    @media (min-width: 768px) {
      main {
        grid-template-columns: 1fr 1fr;
      }
    }
    
    .card {
      background-color: var(--card-bg);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1.5rem;
      transition: var(--transition);
    }
    
    .card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    
    h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    h2 svg {
      width: 1.25rem;
      height: 1.25rem;
    }
    
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    label {
      font-weight: 500;
      margin-bottom: 0.25rem;
      display: block;
    }
    
    input, textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background-color: var(--card-bg);
      color: var(--text);
      font-family: inherit;
      font-size: 1rem;
      transition: var(--transition);
    }
    
    input:focus, textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    
    textarea {
      resize: vertical;
      min-height: 100px;
    }
    
    button {
      background-color: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius);
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    
    button:hover {
      background-color: var(--primary-dark);
    }
    
    button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
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
      border-radius: var(--radius);
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
      max-height: 400px;
      overflow-y: auto;
      padding-right: 0.5rem;
    }
    
    .message {
      padding: 1rem;
      border-radius: var(--radius);
      max-width: 85%;
    }
    
    .message.user {
      background-color: var(--primary);
      color: white;
      align-self: flex-end;
    }
    
    .message.assistant {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      align-self: flex-start;
    }
    
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin: 1rem 0;
      color: var(--text-light);
    }
    
    .loading-spinner {
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid rgba(0, 0, 0, 0.1);
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
      color: #ef4444;
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }
    
    footer {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-light);
      font-size: 0.875rem;
      border-top: 1px solid var(--border);
      margin-top: 2rem;
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
      padding: 0.5rem 1rem;
      border-radius: var(--radius);
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      align-self: flex-start;
      margin-top: 0.5rem;
    }
    
    .typing-dot {
      width: 0.5rem;
      height: 0.5rem;
      background-color: var(--text-light);
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
        transform: translateY(-0.25rem);
      }
    }
    
    /* Responsive adjustments */
    @media (max-width: 640px) {
      header h1 {
        font-size: 1.5rem;
      }
      
      header p {
        font-size: 0.875rem;
      }
      
      .card {
        padding: 1rem;
      }
      
      h2 {
        font-size: 1.25rem;
      }
      
      button {
        padding: 0.625rem 1.25rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>AI Assistant</h1>
    <p>Generate images with Stability AI and chat with Llama 3.3</p>
  </header>
  
  <main>
    <section class="card">
      <h2>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        Image Generation
      </h2>
      <form id="image-form">
        <div>
          <label for="prompt">Describe the image you want to generate</label>
          <textarea id="prompt" name="prompt" placeholder="A serene landscape with mountains and a lake at sunset..." required></textarea>
        </div>
        <button type="submit" id="generate-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Generate Image
        </button>
        <div id="image-loading" class="loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span>Generating your image...</span>
        </div>
        <div id="image-error" class="error" style="display: none;"></div>
      </form>
      <div id="image-result" class="result" style="display: none;">
        <img id="generated-image" class="result-image" alt="Generated image based on your prompt" />
        <button id="download-image" class="button-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Image
        </button>
      </div>
    </section>
    
    <section class="card">
      <h2>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        AI Chat
      </h2>
      <div id="chat-messages" class="chat-messages">
        <div class="message assistant fade-in">
          Hello! I'm your AI assistant powered by Llama 3.3. How can I help you today?
        </div>
      </div>
      <form id="chat-form">
        <div>
          <label for="message">Your message</label>
          <textarea id="message" name="message" placeholder="Ask me anything..." required></textarea>
        </div>
        <button type="submit" id="send-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          Send Message
        </button>
        <div id="chat-loading" class="loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span>Thinking...</span>
        </div>
        <div id="chat-error" class="error" style="display: none;"></div>
      </form>
    </section>
  </main>
  
  <footer>
    <p>Powered by Cloudflare Workers, Stability AI, and Meta's Llama 3.3</p>
    <p>&copy; ${new Date().getFullYear()} - All rights reserved</p>
  </footer>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Image Generation
      const imageForm = document.getElementById('image-form');
      const promptInput = document.getElementById('prompt');
      const generateButton = document.getElementById('generate-button');
      const imageLoading = document.getElementById('image-loading');
      const imageError = document.getElementById('image-error');
      const imageResult = document.getElementById('image-result');
      const generatedImage = document.getElementById('generated-image');
      const downloadImage = document.getElementById('download-image');
      
      // Chat
      const chatForm = document.getElementById('chat-form');
      const messageInput = document.getElementById('message');
      const sendButton = document.getElementById('send-button');
      const chatLoading = document.getElementById('chat-loading');
      const chatErrorElement = document.getElementById('chat-error');
      const chatMessages = document.getElementById('chat-messages');
      
      // Image Generation Form
      imageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const prompt = promptInput.value.trim();
        if (!prompt) return;
        
        // Show loading state
        generateButton.disabled = true;
        imageLoading.style.display = 'flex';
        imageError.style.display = 'none';
        imageResult.style.display = 'none';
        
        try {
          const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate image');
          }
          
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          
          generatedImage.src = imageUrl;
          imageResult.style.display = 'flex';
          
          // Setup download button
          downloadImage.onclick = () => {
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = 'generated-image.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          };
          
        } catch (error) {
          console.error('Error generating image:', error);
          imageError.textContent = error.message || 'Failed to generate image. Please try again.';
          imageError.style.display = 'block';
        } finally {
          generateButton.disabled = false;
          imageLoading.style.display = 'none';
        }
      });
      
      // Chat Form
      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(message, 'user');
        messageInput.value = '';
        
        // Show loading state
        sendButton.disabled = true;
        
        // Create typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `
  \
          <div
  class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        `;
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
          // Create a new message element for the assistant's response
          const assistantMessage = document.createElement('div');
          assistantMessage.classList.add('message', 'assistant', 'fade-in');
          assistantMessage.style.display = 'none'; // Hide initially
          
          // Fetch the streaming response
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get response');
          }
          
          // Process the streaming response
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let responseText = '';
          
          // Remove typing indicator and show the message element
          chatMessages.removeChild(typingIndicator);
          assistantMessage.style.display = 'block';
          chatMessages.appendChild(assistantMessage);
          
          // Read the stream
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            // Decode the chunk and update the UI
            const chunk = decoder.decode(value, { stream: true });
            
            // Parse SSE format
            const lines = chunk.split("\\n");
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const data = line.substring(5).trim();
                  if (data === '[DONE]') continue;
                  
                  // Try to parse as JSON
                  try {
                    const jsonData = JSON.parse(data);
                    if (jsonData.response) {
                      responseText += jsonData.response;
                    }
                  } catch {
                    // If not JSON, just append the data
                    responseText += data;
                  }
                  
                  // Update the message content
                  assistantMessage.textContent = responseText;
                  chatMessages.scrollTop = chatMessages.scrollHeight;
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
          
          // If no text was received, show a fallback message
          if (!responseText.trim()) {
            assistantMessage.textContent = "I'm sorry, I couldn't generate a response. Please try again.";
          }
}
catch (error)
{
  console.error("Error in chat:", error)

  // Remove typing indicator if it exists
  if (chatMessages.contains(typingIndicator)) {
    chatMessages.removeChild(typingIndicator)
  }

  chatErrorElement.textContent = error.message || "Failed to get response. Please try again."
  chatErrorElement.style.display = "block"
}
finally
{
  sendButton.disabled = false
  chatMessages.scrollTop = chatMessages.scrollHeight
}
})

// Helper function to add messages to the chat
function addMessage(text, sender) {
  const messageElement = document.createElement("div")
  messageElement.classList.add("message", sender, "fade-in")
  messageElement.textContent = text

  chatMessages.appendChild(messageElement)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Focus inputs on page load
promptInput.focus()
})
</script>
</body>
</html>`
}


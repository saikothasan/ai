export interface Env {
  AI: any
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Handle image generation
    if (path === "/generate-image") {
      return handleImageGeneration(request, env)
    }

    // Handle chat
    if (path === "/chat") {
      return handleChat(request, env)
    }

    // Return simple HTML interface for testing
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AI Worker</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 min-h-screen p-8">
          <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold mb-8">Cloudflare AI Worker</h1>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <!-- Image Generation -->
              <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-semibold mb-4">Image Generation</h2>
                <div class="mb-4">
                  <label class="block text-sm font-medium mb-1">Prompt</label>
                  <input id="imagePrompt" type="text" class="w-full p-2 border rounded" value="cyberpunk cat">
                </div>
                <button id="generateBtn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Generate Image</button>
                <div class="mt-4">
                  <img id="generatedImage" class="mt-4 max-w-full h-auto hidden">
                </div>
              </div>
              
              <!-- Chat -->
              <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-semibold mb-4">AI Chat</h2>
                <div id="chatMessages" class="mb-4 h-64 overflow-y-auto border rounded p-3"></div>
                <div class="flex">
                  <input id="chatInput" type="text" class="flex-1 p-2 border rounded-l" placeholder="Ask something...">
                  <button id="chatBtn" class="bg-green-500 text-white px-4 py-2 rounded-r hover:bg-green-600">Send</button>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            // Image generation
            document.getElementById('generateBtn').addEventListener('click', async () => {
              const prompt = document.getElementById('imagePrompt').value;
              const img = document.getElementById('generatedImage');
              
              img.classList.add('hidden');
              document.getElementById('generateBtn').textContent = 'Generating...';
              
              try {
                const response = await fetch('/generate-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt })
                });
                
                if (response.ok) {
                  const blob = await response.blob();
                  const url = URL.createObjectURL(blob);
                  img.src = url;
                  img.classList.remove('hidden');
                } else {
                  alert('Error generating image');
                }
              } catch (error) {
                alert('Error: ' + error);
              }
              
              document.getElementById('generateBtn').textContent = 'Generate Image';
            });
            
            // Chat
            document.getElementById('chatBtn').addEventListener('click', async () => {
              const input = document.getElementById('chatInput');
              const message = input.value.trim();
              if (!message) return;
              
              addMessage('user', message);
              input.value = '';
              
              try {
                const response = await fetch('/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message })
                });
                
                if (response.ok) {
                  const data = await response.json();
                  addMessage('assistant', data.response);
                } else {
                  addMessage('system', 'Error: Could not get response');
                }
              } catch (error) {
                addMessage('system', 'Error: ' + error);
              }
            });
            
            function addMessage(role, content) {
              const chatMessages = document.getElementById('chatMessages');
              const messageEl = document.createElement('div');
              messageEl.className = 'mb-2 p-2 rounded ' + 
                (role === 'user' ? 'bg-blue-100 ml-8' : 
                 role === 'assistant' ? 'bg-green-100 mr-8' : 'bg-red-100');
              messageEl.textContent = content;
              chatMessages.appendChild(messageEl);
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          </script>
        </body>
      </html>
      `,
      {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      },
    )
  },
}

async function handleImageGeneration(request: Request, env: Env): Promise<Response> {
  // Only accept POST requests for image generation
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    // Parse the request body to get the prompt
    const { prompt } = await request.json()

    if (!prompt) {
      return new Response("Prompt is required", { status: 400 })
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
    return new Response(`Error generating image: ${error}`, { status: 500 })
  }
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  // Only accept POST requests for chat
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    // Parse the request body to get the message
    const { message } = await request.json()

    if (!message) {
      return new Response("Message is required", { status: 400 })
    }

    // Call the Llama model for chat
    const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: message },
      ],
    })

    // Return the chat response
    return new Response(JSON.stringify({ response: response.response }), {
      headers: {
        "content-type": "application/json",
      },
    })
  } catch (error) {
    return new Response(`Error in chat: ${error}`, { status: 500 })
  }
}


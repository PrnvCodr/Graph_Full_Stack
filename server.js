// A lightweight backend server using Node.js and Express to handle AI API calls.

const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(bodyParser.json());

// --- API Endpoint ---
app.post('/api/ask', async (req, res) => {
    // Check for the environment variable first.
    if (!process.env.GEMINI_API_KEY) {
        console.error("FATAL ERROR: GEMINI_API_KEY environment variable not found on Vercel!");
        return res.status(500).json({ error: 'Server configuration error: The API key is missing.' });
    }

    try {
        const { prompt, graph, history } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required.' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: `You are a helpful AI assistant for a Graph Visualizer. Your responses should be concise and use simple markdown (**bold**, \`code\`).`,
        });

        const historyForChat = history ? history.slice(0, -1) : [];
        const validHistory = historyForChat.filter(
            (msg, i) => (i % 2 === 0 ? msg.role === 'user' : msg.role === 'ai')
        ).map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: msg.parts,
        }));

        const chat = model.startChat({ history: validHistory });

        const contextualPrompt = `Graph State: ${graph.nodeCount} nodes, ${graph.edgeCount} edges. User's Question: "${prompt}"`;

        const result = await chat.sendMessage(contextualPrompt);
        const response = result.response;
        const text = response.text();

        res.json({ response: text });

    } catch (error) {
        console.error('Error with Generative AI:', error);
        res.status(500).json({ error: 'Failed to get a response from the AI. ' + error.message });
    }
});

// Export the app for Vercel
module.exports = app;

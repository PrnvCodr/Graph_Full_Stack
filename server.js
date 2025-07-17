// A lightweight backend server using Node.js and Express to handle AI API calls.

const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config(); // To load environment variables from .env file

const app = express();
const port = 3000;

// --- Middleware ---
app.use(bodyParser.json());

// CORS Middleware to allow requests from your frontend
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});


// --- Gemini AI Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: `You are a helpful and expert AI assistant embedded in a Graph Algorithm Visualizer application.
Your responses should be concise, informative, and formatted with simple markdown (use **bold** for emphasis and \`code\` for technical terms).
Do not use markdown headers (#).`,
});

// --- Helper function for retrying with exponential backoff ---
const sendMessageWithRetry = async (chat, prompt, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await chat.sendMessage(prompt);
            return result; // Success
        } catch (error) {
            // Check if the error is a 503 Service Unavailable
            if (error.status === 503 && i < retries - 1) {
                console.warn(`Attempt ${i + 1} failed with 503. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                throw error; // Rethrow other errors or on final attempt
            }
        }
    }
};


// --- API Endpoint ---
app.post('/api/ask', async (req, res) => {
    try {
        const { prompt, graph, history } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required.' });
        }

        const historyForChat = history ? history.slice(0, -1) : [];
        const validHistory = historyForChat.filter(
            (msg, i) => (i % 2 === 0 ? msg.role === 'user' : msg.role === 'ai')
        ).map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: msg.parts,
        }));

        const chat = model.startChat({
            history: validHistory,
            generationConfig: {
              maxOutputTokens: 500,
            },
        });

        const contextualPrompt = `
            Based on the current graph state, please answer the user's question.

            Current Graph State:
            - **Type**: ${graph.isDirected ? 'Directed' : 'Undirected'}
            - **Weight**: ${graph.isWeighted ? 'Weighted' : 'Unweighted'}
            - **Nodes (${graph.nodeCount})**: ${graph.nodes.join(', ') || 'None'}
            - **Edges (${graph.edgeCount})**: ${graph.edges.map(e => `${e.from} -> ${e.to}` + (graph.isWeighted ? ` (w: ${e.weight})` : '')).join('; ') || 'None'}

            User's Question: "${prompt}"
        `;

        // Use the retry mechanism to send the message
        const result = await sendMessageWithRetry(chat, contextualPrompt);
        const response = result.response;
        const text = response.text();

        res.json({ response: text });

    } catch (error) {
        console.error('Error with Generative AI:', error);
        res.status(500).json({ error: 'Failed to get a response from the AI.' });
    }
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`🤖 AI Assistant backend server listening on http://localhost:${port}`);
    if (!process.env.GEMINI_API_KEY) {
        console.warn("⚠️ WARNING: GEMINI_API_KEY is not set. Please create a .env file and add your API key.");
    }
});
module.exports = app;
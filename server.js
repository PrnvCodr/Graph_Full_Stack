const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(bodyParser.json());

app.post('/api/ask', async (req, res) => {
    // This check is crucial. It runs first.
    if (!process.env.GEMINI_API_KEY) {
        console.error("FATAL ERROR: GEMINI_API_KEY environment variable not found on Vercel!");
        return res.status(500).json({ error: 'Server configuration error: The API key is missing.' });
    }

    try {
        const { prompt, graph, history } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required.' });
        }
        
        // Initialize the AI safely inside the handler
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Prepare the history for the AI
        const historyForChat = history ? history.slice(0, -1) : []; // Get all messages except the last one (the user's new prompt)
        
        let validHistory = historyForChat.map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: msg.parts,
        }));

        // --- THIS IS THE FIX ---
        // The Gemini API requires the conversation history to start with a 'user' role.
        // If the first message in our history is the AI's welcome message, we remove it.
        if (validHistory.length > 0 && validHistory[0].role === 'model') {
            validHistory.shift(); // Removes the first element
        }
        
        const chat = model.startChat({ history: validHistory });
        
        const contextualPrompt = `Graph State: ${graph.nodeCount} nodes, ${graph.edgeCount} edges. User: "${prompt}"`;

        const result = await chat.sendMessage(contextualPrompt);
        res.json({ response: result.response.text() });

    } catch (error) {
        console.error('Error with Generative AI:', error);
        res.status(500).json({ error: 'Failed to get a response from the AI. ' + error.message });
    }
});

// This is the only export needed for Vercel.
module.exports = app;

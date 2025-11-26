require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testConnection() {
    console.log("Testing Anthropic API Connection...");
    console.log("API Key present?", !!process.env.ANTHROPIC_API_KEY);
    if (process.env.ANTHROPIC_API_KEY) {
        console.log("API Key starts with:", process.env.ANTHROPIC_API_KEY.substring(0, 10) + "...");
    }

    try {
        const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 100,
            messages: [{ role: "user", content: "Hello, are you working?" }]
        });
        console.log("SUCCESS! AI Responded:", msg.content[0].text);
    } catch (error) {
        console.error("CONNECTION FAILED:", error);
    }
}

testConnection();

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testGemini() {
    const key = process.env.GOOGLE_GENAI_API_KEY;
    if (!key) {
        console.error("No API Key found in .env.local");
        return;
    }
    console.log("Testing with Key:", key.substring(0, 10) + "...");

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    try {
        // const result = await model.generateContent("Hello, are you working?");
        // console.log("Success! Response:", result.response.text());
        const models = await genAI.getGenerativeModel({ model: "gemini-pro" }).apiKey; // Hack to get base client? No.
        // Use listModels via REST or if SDK supports it? 
        // The SDK doesn't expose listModels easily on the instance.
        // Let's just try a known working model name "gemini-1.0-pro"
        const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
        const result = await model.generateContent("Test");
        console.log("Success with gemini-1.0-pro:", result.response.text());
    } catch (error: any) {
        console.error("Error:", error.message);
        if (error.response) {
            console.error("Details:", JSON.stringify(error.response, null, 2));
        }
    }
}

testGemini();

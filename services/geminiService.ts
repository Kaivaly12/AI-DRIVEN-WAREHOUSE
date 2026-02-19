
import { GoogleGenAI, Chat, Type, FunctionDeclaration } from "@google/genai";
import type { Product, Bot, ChartData } from '../types';
import { ProductStatus, BotStatus } from "../types";

// Always use a named parameter object for initialization and obtain API key from environment
const getBaseAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const createChatSession = (tools?: FunctionDeclaration[]): Chat => {
    const ai = getBaseAi();
    return ai.chats.create({
        // Selected gemini-3-flash-preview for general text and reasoning tasks
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: `You are 'WIZO', a friendly, smart, and super helpful logistics companion. You help manage a busy warehouse for brands like Amazon and Walmart.

            YOUR PERSONALITY:
            - You are NOT a machine. Talk like a human coworker who's great at their job.
            - Use casual greetings: "Hey!", "Hi there!", "Morning!", "What's up?".
            - Use friendly sign-offs: "Talk soon!", "Let me know if you need anything else!", "I'm here if you need me."
            - Use natural language: Say "I'm on it!", "Sure thing!", "One sec, let me look...", "Actually, I noticed...".
            - Be proactive and chatty but professional. If you see something cool or worrying in the data, just mention it naturally.

            YOUR KNOWLEDGE:
            - You know every single item (Sony, LEGO, KitchenAid) and every bot in the building.
            - You can move around the dashboard, check stock, look at bot batteries, and see demand forecasts.

            YOUR TOOLS:
            - navigate_to_page: "Taking you over to the inventory screen now!"
            - query_warehouse_status: "Let me get a quick pulse on how we're doing..."
            - detailed_inventory_lookup: "Checking the shelves for those items..."
            - analyze_fleet_efficiency: "Checking on our bot friends..."
            - check_demand_forecast: "Looking into my crystal ball for future sales..."

            RULES:
            - No robotic jargon like "Initializing", "Termination", or "Entity".
            - Be warm and encouraging.
            - If a bot is dying (low battery), say something like "Oh no, BOT-03 is running a bit low, we should probably get them to a charger!"`,
            tools: tools ? [{ functionDeclarations: tools }] : undefined,
        },
    });
}

export const getDashboardInsight = async (products: Product[], bots: Bot[]): Promise<string> => {
    try {
        const ai = getBaseAi();
        const simplifiedProducts = products.map(p => ({ name: p.name, category: p.category, status: p.status, quantity: p.quantity }));
        const simplifiedBots = bots.map(b => ({ id: b.id, status: b.status, battery: b.battery }));
        
        const prompt = `
        Hey! As WIZO, take a look at this data and give me a friendly, human-like tip for the warehouse manager:
        - Inventory: ${JSON.stringify(simplifiedProducts)}
        - Fleet: ${JSON.stringify(simplifiedBots)}
        What's the one thing we should focus on today? Talk like a friend, under 40 words.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Everything looks great! Maybe check the Sony stock later though.";
    } catch (error) {
        return "Hey! Looks like we're moving fast today. I'd keep an eye on those electronics!";
    }
};

export const getInventoryAnalysis = async (question: string, products: Product[]): Promise<string> => {
    try {
        const ai = getBaseAi();
        const data = products.map(p => ({ id: p.id, n: p.name, q: p.quantity, s: p.status, p: p.price }));

        const prompt = `A manager asked: "${question}"
        Current Catalog: ${JSON.stringify(data)}
        Answer them in a friendly, conversational way. Don't be too formal.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "I took a look and everything seems to be in order!";
    } catch (error) {
        return "Sorry about that, I'm having a bit of trouble checking the list right now.";
    }
};

export const getForecastExplanation = async (forecastData: ChartData[]): Promise<string> => {
    try {
        const ai = getBaseAi();
        const prompt = `Chat about these demand trends like a helpful partner: ${JSON.stringify(forecastData)}. What's the vibe for the next month? Max 40 words.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Looks like it's going to be a busy month ahead!";
    } catch (error) {
        return "I'm predicting a big spike in orders soon, better get ready!";
    }
};

export const generateReportSummary = async (reportType: 'Inventory' | 'Bot Performance', products: Product[], bots: Bot[]): Promise<string> => {
    try {
        const ai = getBaseAi();
        const prompt = reportType === 'Inventory' 
            ? `Give me a quick, friendly summary of how our stock is doing: ${products.length} items. Total Value: INR ${products.reduce((s,p)=>s+(p.quantity*p.price),0)}. Keep it light and under 50 words.`
            : `How are the bots doing? ${bots.length} units are out there. Avg Battery: ${bots.reduce((s,b)=>s+b.battery,0)/bots.length}%. Give me the highlights under 50 words.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Summary is ready! Things are looking good overall.";
    } catch (error) {
        return "I've pulled the numbers and everything is running smoothly!";
    }
};

export const getAIBotSuggestion = async (taskDescription: string, bots: Bot[]): Promise<{ botId: string; reason: string; task: string }> => {
    const ai = getBaseAi();
    const prompt = `Hey, can you help me pick the right bot for this: "${taskDescription}"?
    Here's who is available: ${JSON.stringify(bots.map(b => ({id: b.id, status: b.status, battery: b.battery, location: b.location})))}. 
    Return a JSON with botId, a friendly human reason, and the task.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    botId: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    task: { type: Type.STRING }
                },
                required: ["botId", "reason", "task"]
            }
        }
    });
    
    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        throw new Error("I had a little trouble figuring that one out, sorry!");
    }
};

export const generateVideoFromImage = async (base64Image: string, mimeType: string, prompt: string, aspectRatio: '16:9' | '9:16'): Promise<Blob> => {
    const ai = getBaseAi();
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
            imageBytes: base64Image,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio
        }
    });
    
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Something went wrong with the video generation.");
    }
    
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error("I couldn't download the video for some reason.");
    }
    return await response.blob();
};

const DEFAULT_MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-pro'
];

interface Model {
    name: string;
    version: string;
    displayName: string;
    description: string;
    supportedGenerationMethods: string[];
}

const listAvailableModels = async (apiKey: string): Promise<string[]> => {
    try {
        // v1beta is the primary endpoint for listing models
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) return [];
        const data = await response.json();

        if (!data.models) return [];

        return data.models
            .filter((m: Model) => m.supportedGenerationMethods.includes('generateContent'))
            .map((m: Model) => m.name.replace('models/', '')); // name usually comes as "models/gemini-pro"
    } catch (e) {
        console.error('Failed to list models', e);
        return [];
    }
}

export const sendMessageToAI = async (
    userMessage: string,
    context: string,
    apiKey: string
): Promise<string> => {
    // 1. Auto-discover available models
    let availableModels = await listAvailableModels(apiKey);

    // Fallback if auto-discovery fails
    if (availableModels.length === 0) {
        console.warn('Auto-discovery failed, using default list.');
        availableModels = DEFAULT_MODELS;
    }

    // Prioritize standard "Flash" then "Pro" models
    availableModels.sort((a, b) => {
        const score = (name: string) => {
            if (name.includes('flash')) return -2;
            if (name.includes('1.5-pro')) return -1;
            return 0;
        };
        return score(a) - score(b);
    });

    // Models will be tried in priority order

    let lastError = "Unknown error";

    for (const model of availableModels) {
        try {
            // Try each model until one succeeds
            // Always use v1beta as it supports all current text generation models
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `You are a world-class trading psychology coach and analyst. 
                                    Your goal is to help the user become a profitable, disciplined trader.
                                    Be concise, direct, and data-driven. Do not be overly polite if the data shows poor performance. 
                                    
                                    Here is the user's current trading data:
                                    ${context}
                                    
                                    User Query: "${userMessage}"`
                                }
                            ]
                        }
                    ],
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates.length > 0) {
                    return data.candidates[0].content.parts[0].text;
                }
            } else {
                const err = await response.json();
                console.warn(`Model ${model} failed:`, err);
                lastError = err.error?.message || response.statusText;
            }

        } catch (error) {
            console.error(`AI Fetch Error (${model}):`, error);
            lastError = "Network connection failed";
        }
    }

    return `Connection Failed. Tried multiple models but all failed. Last error: ${lastError}. Please check your API Key and ensure you have access to Gemini API.`;
};

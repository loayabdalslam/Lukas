import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Agent, Clarification, Conversation, Geolocation, PlanStep, GroundingSource, StepResult } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const planResponseSchema = {
    type: Type.OBJECT,
    properties: {
        plan: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    step: { type: Type.INTEGER },
                    agent: { type: Type.STRING, enum: Object.values(Agent) },
                    task: { type: Type.STRING },
                },
                required: ["step", "agent", "task"],
            },
        },
        clarification_needed: {
            type: Type.OBJECT,
            properties: {
                question: { type: Type.STRING },
                options: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            key: { type: Type.STRING },
                            value: { type: Type.STRING },
                        },
                        required: ["key", "value"],
                    }
                }
            },
            required: ["question", "options"]
        }
    }
};

export const generatePlan = async (prompt: string, hasImage: boolean, hasVideo: boolean, history: Conversation[], cycleCount: number): Promise<{ plan?: PlanStep[]; clarification?: Clarification }> => {
  const historyText = history.length > 0
    ? history
        .map(c => {
            const orchestratorResults = (c.results || []).filter(r => r.agent === Agent.Orchestrator && r.status === 'completed');
            
            let lukasResponse = 'I executed the request.';
            if (orchestratorResults.length > 0) {
                // Find the result from the orchestrator step with the highest step number, which is the final answer.
                const finalResult = orchestratorResults.reduce((prev, current) => (prev.step > current.step) ? prev : current);
                lukasResponse = finalResult.result;
            }
            
            // To keep the history prompt concise for the model
            const conciseResponse = lukasResponse.length > 400 ? lukasResponse.substring(0, 400) + '...' : lukasResponse;

            return `User: ${c.prompt}\nLukas: ${conciseResponse}`;
        })
        .join('\n---\n')
    : 'No history yet.';

  let fullPrompt = `You are "Lukas", an AI Orchestrator. Your job is to create a plan for your team of specialized AI agents based on the user's request and the conversation history.

Your available agents are:
- SearchAgent: For web searches (news, facts, real-time info).
- MapsAgent: For location-based queries (places, directions, distances).
- VisionAgent: For analyzing an image provided by the user.
- VideoAgent: For analyzing a video provided by the user.
- ImageGenerationAgent: For creating a new image from a text description.
- EmailAgent: For sending emails.
- SheetsAgent: A tool to format data into a spreadsheet. It must follow a data-providing agent. Its task is to take the output from the immediately preceding step and organize it.
- DriveAgent: For interacting with files in a cloud drive.

--- CONVERSATION HISTORY (FOR CONTEXT) ---
${historyText}
-------------------------------------------

User Settings: The user has set an iteration 'cycle count' of ${cycleCount}. A higher number (e.g., 3-5) indicates a request for a more thorough, multi-step, and exhaustive plan. A lower number (e.g., 1) is for a standard, direct plan. Factor this into the complexity and depth of the plan you generate.

Now, analyze the user's NEW request based on the history and settings above.

User's New Request: "${prompt}"

Your Task:
1.  Analyze the request in the context of the conversation and cycle count.
2.  If the request is clear and actionable, create a step-by-step plan using the mandatory "To-Do & Validate" structure described below.
3.  **Clarification Rule**: If the user is asking for data (like a list, table, etc.) and it's unclear if they want a downloadable file or just to see it on screen, you MUST ask for clarification. Do this by responding with a 'clarification_needed' object instead of a 'plan'. The question should be direct, and the options should be clear (e.g., "Downloadable File" vs. "Display Only").
4.  If the user has already clarified or their intent is obvious (e.g., "create a spreadsheet of..."), generate the plan directly. A plan for a file MUST include a 'SheetsAgent' step.

**Mandatory "To-Do & Validate" Planning Structure:**
1.  Your **first step** MUST be the 'Orchestrator' agent. The task for this step is to create a high-level to-do list for the user's request.
2.  After EACH data-gathering or action agent step (Search, Maps, Vision, Video, ImageGeneration, Drive), you MUST insert an 'Orchestrator' agent step to validate the results. Example task: "Validate progress against the to-do list and decide the next action."
3.  The **final step** is always the 'Orchestrator' agent with the task "Synthesize the results into a final answer for the user."
This creates a cycle: Plan (To-Do) -> Act -> Validate -> Act -> Validate -> ... -> Synthesize.

Your response must be a single JSON object matching the provided schema, containing EITHER a 'plan' OR a 'clarification_needed' field, but not both.`;
  
  if (hasImage) {
    fullPrompt += "\nAn image has been provided. The VisionAgent must be used.";
  }
  if (hasVideo) {
    fullPrompt += "\nA video has been provided. The VideoAgent must be used.";
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: planResponseSchema,
      },
    });
    const resultText = response.text.trim();
    const resultJson = JSON.parse(resultText);

    if (resultJson.plan) {
        return { plan: resultJson.plan };
    } else if (resultJson.clarification_needed) {
        return { clarification: resultJson.clarification_needed };
    } else {
        throw new Error("AI response did not contain a plan or a clarification request.");
    }
  } catch (error) {
    console.error("Error generating plan:", error);
    throw new Error("Failed to generate a valid execution plan.");
  }
};


const streamContent = async (
    model: string, 
    contents: any, 
    config: any, 
    onChunk: (chunk: string) => void
) => {
    const responseStream = await ai.models.generateContentStream({ model, contents, config });
    for await (const chunk of responseStream) {
        onChunk(chunk.text);
    }
};

export const executeSearch = async (task: string, onChunk: (chunk: string) => void) => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: task,
        config: { tools: [{ googleSearch: {} }] },
    });
    
    onChunk(response.text);

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
        .map((chunk: any) => ({
            title: chunk.web?.title || 'Untitled',
            uri: chunk.web?.uri || '',
            agent: Agent.SearchAgent,
        }))
        .filter((source: any) => source.uri);

    return { sources };
};

export const executeMap = async (task: string, location: Geolocation | null, onChunk: (chunk: string) => void) => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: task,
        config: {
          tools: [{googleMaps: {}}],
          toolConfig: location ? { retrievalConfig: { latLng: { latitude: location.latitude, longitude: location.longitude } } } : undefined,
        },
    });

    onChunk(response.text);

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
        .map((chunk: any) => ({
            title: chunk.maps?.title || 'Untitled Place',
            uri: chunk.maps?.uri || '',
            agent: Agent.MapsAgent,
        }))
        .filter((source: any) => source.uri);

    return { sources };
};

export const executeVision = async (task: string, imageFile: File, onChunk: (chunk: string) => void) => {
    const imagePart = await fileToGenerativePart(imageFile);
    await streamContent("gemini-2.5-flash", { parts: [{ text: task }, imagePart] }, {}, onChunk);
    return {};
};

// FIX: Updated `executeVideo` to correctly process and send the video file to the Gemini API.
export const executeVideo = async (task: string, videoFile: File, onChunk: (chunk: string) => void) => {
    const videoPart = await fileToGenerativePart(videoFile);
    await streamContent("gemini-2.5-pro", { parts: [{ text: task }, videoPart] }, {}, onChunk);
    return {};
};

export const executeImageGeneration = async (task: string, onChunk: (chunk: string) => void) => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: task }] },
        config: { responseModalities: [Modality.IMAGE] },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            onChunk(`Successfully generated image based on the prompt: "${task}".`);
            return { imageBase64: base64ImageBytes };
        }
    }
    throw new Error("Image generation failed to return an image.");
};

export const executeEmail = async (task: string, onChunk: (chunk: string) => void) => {
    const result = `Simulated sending email based on task: "${task}".\n\nEmail prepared and sent successfully.`;
    onChunk(result); 
    return {};
};

export const executeSheets = async (task: string, previousData: string, onChunk: (chunk: string) => void) => {
    const prompt = `You are a data formatting tool. Your job is to convert raw text data into a structured JSON array of objects based on a user's instruction.

User's formatting instruction: "${task}"

Raw data from previous step to be formatted:
"""
${previousData}
"""

Based on the instruction, process the raw data and generate a JSON object. The JSON object must have a single key "data", which is an array of objects. Each object represents a row. Respond with only the raw JSON object, without any markdown or explanations.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    });

    let resultText = response.text.trim();
    
    // In case the model still returns markdown, strip it.
    if (resultText.startsWith("```json")) {
        resultText = resultText.substring(7, resultText.length - 3).trim();
    } else if (resultText.startsWith("```")) {
         resultText = resultText.substring(3, resultText.length - 3).trim();
    }

    const resultJson = JSON.parse(resultText);
    
    const rowCount = resultJson.data?.length || 0;
    const summaryMessage = `Successfully formatted ${rowCount} rows of data from the previous step.`;
    
    onChunk(summaryMessage);

    return { sheetData: resultJson.data };
};

export const executeDrive = async (task: string, onChunk: (chunk: string) => void) => {
    let result = `Simulated Google Drive operation based on task: "${task}".\n\n`;
    if (task.toLowerCase().includes("find") || task.toLowerCase().includes("search")) {
        result += `Found 3 relevant files:\n- 'Project_Proposal_v3.docx'\n- 'Competitor_Analysis.pptx'\n- 'Meeting_Notes_2024-07-22.gdoc'`;
    } else if (task.toLowerCase().includes("summarize")) {
        result += `Summarized 'Project_Proposal_v3.docx': The document outlines a plan for a new mobile application, detailing the target audience, features, and marketing strategy.`;
    } else {
        result += `Operation completed successfully in Google Drive.`;
    }
    onChunk(result);
    return {};
};

export const executeOrchestratorIntermediateStep = async (task: string, originalPrompt: string, results: StepResult[], onChunk: (chunk: string) => void) => {
    const synthesisPrompt = `You are "Lukas", the AI Orchestrator, in the middle of executing a plan.
Original User Request: "${originalPrompt}"

Here are the results from your agents so far:
${results.map(r => `- ${r.agent} (Task: "${r.task}"):\n  - Result: ${r.result}`).join('\n\n')}

Your current internal task is: "${task}".

Your response must be user-facing.

**Instructions:**
- If your task is to create a "to-do list" or "checklist", you MUST respond with the complete to-do list formatted in Markdown. Start with a brief introductory sentence (e.g., "Here is my plan:").
- If your task is to "validate" or "check progress", you MUST respond with a brief, conversational status update (1-2 sentences). Explain what you've just done and what you'll do next (e.g., "I've found the cafes, now I'll get their addresses.").

Do not talk about agents or internal plans. Speak naturally to the user.`;
    
    await streamContent("gemini-2.5-pro", synthesisPrompt, {}, onChunk);
    return {};
};


export const synthesizeAnswer = async (originalPrompt: string, results: { agent: Agent, task: string, result: string }[], onChunk: (chunk: string) => void) => {
    const synthesisPrompt = `You are "Lukas", the AI Orchestrator. Your agent team has completed their tasks. Now, your final job is to synthesize their findings into a single, comprehensive, and well-formatted answer for the user.

Original User Request: "${originalPrompt}"

Here are the results from your agents:
${results.map(r => `- ${r.agent} (Task: "${r.task}"):\n  - Result: ${r.result}`).join('\n\n')}

Synthesize these results into a final, user-friendly response. Address the user's original request directly. Do not mention the step-by-step process unless it's relevant to the answer. Use markdown for formatting.
Crucially, DO NOT include any raw JSON data, JSON objects, or code blocks in your final answer. Present information in a clean, readable, natural language format. If a spreadsheet was created, simply state that it was created successfully and briefly describe its contents.`;
    
    await streamContent("gemini-2.5-pro", synthesisPrompt, {}, onChunk);
    return {};
};
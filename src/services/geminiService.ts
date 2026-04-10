import { GoogleGenAI } from "@google/genai";
import { Message, AppState } from "../types";

export async function sendMessageToGemini(
  apiKey: string,
  history: Message[],
  currentState: AppState
) {
  const ai = new GoogleGenAI({ apiKey });
  
  // Determine temperature based on phase
  let temperature = 0.7;
  if (currentState === AppState.PHASE2 || currentState === AppState.PHASE3) {
    temperature = 0.3;
  }

  const systemMessage = history.find(m => m.role === 'system');
  const chatHistory = history
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role,
      parts: m.parts
    }));

  // The last message is the user input
  const lastUserMessage = chatHistory[chatHistory.length - 1]?.parts[0].text || "";
  
  // We need to send the history as contents
  // The SDK expects contents: [{ role: 'user', parts: [...] }, ...]
  const contents = chatHistory;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        temperature,
        systemInstruction: systemMessage?.parts[0].text,
      },
    });
    return response.text || "";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw error;
  }
}

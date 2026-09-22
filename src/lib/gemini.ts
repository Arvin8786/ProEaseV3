import { auth } from './firebase';

class SecureAIProxy {
  models = {
    generateContent: async (params: any) => {
      let token = '';
      if (auth && auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      const response = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        let errMessage = 'Backend AI Proxy Error';
        try {
          const errorData = await response.json();
          errMessage = errorData.error || errMessage;
        } catch {
          // fallback
        }
        throw new Error(errMessage);
      }
      
      return await response.json();
    }
  };
}

export const ai = new SecureAIProxy() as any;

export const MODELS = {
  flash: "gemini-3.8-flash",
  pro: "gemini-3.1-pro-preview",
};

export async function generateText(prompt: string, systemInstruction?: string) {
  try {
    const response = await ai.models.generateContent({
      model: MODELS.flash,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

export async function analyzeImage(base64Data: string, mimeType: string, prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: MODELS.flash,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }
      ],
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

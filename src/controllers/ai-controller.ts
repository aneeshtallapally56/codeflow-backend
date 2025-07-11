import { Request, Response } from "express";
import { GoogleGenerativeAI } from '@google/generative-ai';
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY environment variable is not defined');
}
const genAI = new GoogleGenerativeAI(geminiApiKey);

export const generateResponse = async (req: Request, res: Response): Promise<void> => {
  try {
   const {prompt,code} = req.body;

    if (!prompt || !code) {
     res.status(400).json({ error: "Missing prompt or code" });
      return ;
    }
     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const promptTemplate = `
You are an AI code editor assistant.

Your job is to take the following code and modify it based on the user’s instruction.

 IMPORTANT RULES:
- Return ONLY the complete, final modified code.
- DO NOT include any explanation, extra text, or markdown formatting.
- DO NOT wrap the code with triple backticks (no \`\`\`).
- DO NOT include comments unless specifically asked for in the prompt.
- The returned code must be clean and ready to run or paste into an editor.

---  
USER INSTRUCTION:
${prompt}

---  
ORIGINAL CODE:
${code}

---  
FINAL MODIFIED CODE:
`;
        const result = await model.generateContent([
      promptTemplate
    ]);
     const response = result.response;
    const text = response.text();
     res.status(200).json({
      success: true,
      content: text,
    });

  } catch (error) {
    console.error("Error generating AI response:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export const fixCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: "Missing code" });
      return;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const promptTemplate = `
You are an AI code editor assistant.
Your job is to take the following code and fix any errors or issues.
IMPORTANT RULES:
- Return ONLY the complete, fixed code.
- DO NOT include any explanation, extra text, or markdown formatting.
- DO NOT wrap the code with triple backticks (no \`\`\`).
- DO NOT include comments unless specifically asked for in the prompt.  
- The returned code must be clean and ready to run or paste into an editor.
---
ORIGINAL CODE:
${code}
---
FINAL FIXED CODE:
`;
    const result = await model.generateContent([promptTemplate]);
    const response = result.response;
    const text = response.text();
    res.status(200).json({
      success: true,
      content: text,
    });
  } catch (error) {
    console.error("Error fixing code:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
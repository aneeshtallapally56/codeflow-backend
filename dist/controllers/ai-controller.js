"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixCode = exports.generateResponse = void 0;
const generative_ai_1 = require("@google/generative-ai");
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not defined');
}
const genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey);
const generateResponse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { prompt, code } = req.body;
        if (!prompt || !code) {
            res.status(400).json({ error: "Missing prompt or code" });
            return;
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
        const result = yield model.generateContent([
            promptTemplate
        ]);
        const response = result.response;
        const text = response.text();
        res.status(200).json({
            success: true,
            content: text,
        });
    }
    catch (error) {
        console.error("Error generating AI response:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.generateResponse = generateResponse;
const fixCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const result = yield model.generateContent([promptTemplate]);
        const response = result.response;
        const text = response.text();
        res.status(200).json({
            success: true,
            content: text,
        });
    }
    catch (error) {
        console.error("Error fixing code:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.fixCode = fixCode;

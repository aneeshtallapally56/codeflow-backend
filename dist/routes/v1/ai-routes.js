"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ai_controller_1 = require("../../controllers/ai-controller");
const router = express_1.default.Router();
router.post('/generate', ai_controller_1.generateResponse);
router.post('/fix', ai_controller_1.fixCode);
exports.default = router;

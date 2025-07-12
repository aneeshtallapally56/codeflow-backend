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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkProjectAccess = void 0;
const Project_1 = __importDefault(require("../models/Project"));
const checkProjectAccess = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const userId = user._id.toString(); // ✅ consistent userId extraction
        const projectId = req.params.projectId;
        const project = yield Project_1.default.findById(projectId);
        if (!project) {
            res.status(404).json({ success: false, message: "Project not found" });
            return;
        }
        const isOwner = project.user.toString() === userId;
        const isCollaborator = project.members
            .map((id) => id.toString())
            .includes(userId);
        if (!isOwner && !isCollaborator) {
            res.status(403).json({ success: false, message: "Access denied" });
            return;
        }
        next();
    }
    catch (err) {
        console.error("checkProjectAccess error:", err);
        res.status(500).json({ success: false, message: "Server error" });
        return;
    }
});
exports.checkProjectAccess = checkProjectAccess;

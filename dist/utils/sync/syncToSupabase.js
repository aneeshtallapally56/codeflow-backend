"use strict";
// utils/syncProject.ts
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
exports.syncProjectToSupabase = syncProjectToSupabase;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const zipDirectory_1 = require("../upload/zipDirectory");
const uploadToSupabase_1 = require("../upload/uploadToSupabase");
const projectPath_1 = require("../projectPath/projectPath");
function syncProjectToSupabase(projectId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const zipPath = `/tmp/${projectId}.zip`;
        const projectPath = path_1.default.join((0, projectPath_1.getProjectPath)(projectId), "sandbox");
        try {
            yield (0, zipDirectory_1.zipDirectory)(projectPath, zipPath);
            yield (0, uploadToSupabase_1.uploadToSupabase)(zipPath, userId, projectId);
            yield promises_1.default.unlink(zipPath); // clean up
        }
        catch (err) {
            console.error("❌ Failed to sync project to Supabase:", err);
        }
    });
}

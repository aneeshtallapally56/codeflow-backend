"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectPath = getProjectPath;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
function getProjectPath(projectId) {
    return path_1.default.join(os_1.default.tmpdir(), projectId);
}

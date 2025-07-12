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
exports.deleteProjectService = exports.getProjectTree = exports.createProjectService = void 0;
const uuid4_1 = __importDefault(require("uuid4"));
const promises_1 = __importDefault(require("fs/promises"));
const directory_tree_1 = __importDefault(require("directory-tree"));
const exec_utility_1 = require("../utils/exec-utility");
const projectPath_1 = require("../utils/projectPath/projectPath");
const createProjectService = (type) => __awaiter(void 0, void 0, void 0, function* () {
    const framework = type;
    const projectId = (0, uuid4_1.default)();
    const projectPath = (0, projectPath_1.getProjectPath)(projectId);
    // Ensure tmp directory exists
    yield promises_1.default.mkdir(projectPath, { recursive: true });
    let command = "";
    switch (framework) {
        case "React":
            command = process.env.REACT_PROJECT_COMMAND;
            break;
        case "Vue":
            command = process.env.VUE_PROJECT_COMMAND;
            break;
        case "NextJs":
            command = process.env.NEXT_PROJECT_COMMAND;
            break;
        case "Angular":
            command = process.env.ANGULAR_PROJECT_COMMAND;
            break;
        default:
            throw new Error(`Unsupported framework type: ${framework}`);
    }
    try {
        yield (0, exec_utility_1.execPromise)(command, { cwd: projectPath });
        // Verify project was created successfully
        const projectContents = yield promises_1.default.readdir(projectPath);
        if (projectContents.length === 0) {
            throw new Error("Project creation resulted in empty directory");
        }
    }
    catch (err) {
        console.error("❌ Error running command:");
        console.error("Message:", err.message);
        console.error("Stack:", err.stack);
        console.error("Command Output:", err.stdout || err.stderr || err.output);
        // Clean up on failure
        try {
            yield promises_1.default.rm(projectPath, { recursive: true, force: true });
        }
        catch (cleanupErr) {
            console.error("Failed to clean up project directory:", cleanupErr);
        }
        throw err;
    }
    return projectId;
});
exports.createProjectService = createProjectService;
const getProjectTree = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
    const projectPath = (0, projectPath_1.getProjectPath)(projectId);
    try {
        // Check if project directory exists
        yield promises_1.default.access(projectPath);
        const projectTree = (0, directory_tree_1.default)(projectPath, {
            exclude: /node_modules|\.git|\.next|dist|build/
        });
        if (!projectTree) {
            throw new Error("Project directory is empty or inaccessible");
        }
        return projectTree;
    }
    catch (err) {
        console.error("Error accessing project directory:", err);
        throw new Error(`Project directory not found: ${projectPath}`);
    }
});
exports.getProjectTree = getProjectTree;
const deleteProjectService = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
    const projectPath = (0, projectPath_1.getProjectPath)(projectId);
    try {
        yield promises_1.default.access(projectPath);
        yield promises_1.default.rm(projectPath, { recursive: true, force: true });
    }
    catch (err) {
        console.warn("⚠️ Project folder not found or already deleted:", projectPath);
    }
});
exports.deleteProjectService = deleteProjectService;

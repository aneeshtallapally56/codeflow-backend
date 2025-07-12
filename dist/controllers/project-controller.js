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
exports.leaveProject = exports.joinProject = exports.getProjectById = exports.deleteProject = exports.getUserProjects = void 0;
exports.createProject = createProject;
exports.getProjectTree = getProjectTree;
const project_service_1 = require("../services/project-service");
const project_service_2 = require("../services/project-service");
const project_service_3 = require("../services/project-service");
const Project_1 = __importDefault(require("../models/Project"));
require("../types/express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const zipDirectory_1 = require("../utils/upload/zipDirectory");
const uploadToSupabase_1 = require("../utils/upload/uploadToSupabase");
const downloadAndExtractZip_1 = require("../utils/download/downloadAndExtractZip");
const supabase_1 = require("../config/supabase");
const projectPath_1 = require("../utils/projectPath/projectPath"); // Add this import
function createProject(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { title, type } = req.body;
            const user = req.user;
            const userId = user._id.toString();
            if (!userId || !title) {
                res.status(400).json({ message: "Missing title or userId" });
                return;
            }
            // Create project in system temp directory
            const projectId = yield (0, project_service_1.createProjectService)(type);
            const projectPath = (0, projectPath_1.getProjectPath)(projectId); // Use getProjectPath instead of hardcoded path
            const zipPath = path_1.default.join(path_1.default.dirname(projectPath), `${projectId}.zip`); // Create zip in same temp directory
            // Verify project was created
            if (!fs_1.default.existsSync(projectPath)) {
                throw new Error("Project directory was not created");
            }
            // Zip the project directory
            yield (0, zipDirectory_1.zipDirectory)(projectPath, zipPath);
            // Upload to Supabase
            const downloadUrl = yield (0, uploadToSupabase_1.uploadToSupabase)(zipPath, userId, projectId);
            // Create database entry
            const newProject = yield Project_1.default.create({
                _id: projectId,
                title,
                type,
                user: userId,
                downloadUrl,
                members: [userId]
            });
            // Clean up zip file but keep the project directory
            if (fs_1.default.existsSync(zipPath)) {
                fs_1.default.unlinkSync(zipPath);
            }
            res.status(200).json({
                message: "Project created successfully",
                projectId,
                downloadUrl
            });
        }
        catch (error) {
            const err = error;
            console.error("Error creating project folder:", err.message);
            res.status(500).json({
                error: err.message || "Failed to create project directory",
            });
        }
    });
}
function getProjectTree(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { projectId } = req.params;
            const project = yield Project_1.default.findById(projectId);
            if (!project || !project.downloadUrl) {
                res.status(404).json({ message: "Project not found or missing download URL" });
                return;
            }
            const projectPath = (0, projectPath_1.getProjectPath)(projectId); // Use getProjectPath instead of hardcoded path
            // Check if project exists in tmp and has content
            const projectExists = fs_1.default.existsSync(projectPath);
            let hasContent = false;
            if (projectExists) {
                try {
                    const files = fs_1.default.readdirSync(projectPath);
                    hasContent = files.length > 0;
                }
                catch (err) {
                    console.warn("Error reading project directory:", err);
                    hasContent = false;
                }
            }
            // Extract from Supabase if project doesn't exist or is empty
            if (!projectExists || !hasContent) {
                yield (0, downloadAndExtractZip_1.downloadAndExtractZip)(projectId, project.downloadUrl);
            }
            else {
            }
            const tree = yield (0, project_service_2.getProjectTree)(projectId);
            res.status(200).json({
                message: "Project tree retrieved successfully",
                tree,
            });
        }
        catch (error) {
            const err = error;
            console.error("Error retrieving tree:", err.message);
            res.status(500).json({ error: err.message });
        }
    });
}
const getUserProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const userId = user._id.toString();
        if (!(user === null || user === void 0 ? void 0 : user._id)) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const projects = yield Project_1.default.find({
            $or: [
                { user: user._id },
                { members: user._id }
            ]
        })
            .sort({ createdAt: -1 })
            .populate("user", "username avatarUrl")
            .populate("members", "username avatarUrl");
        res.status(200).json({ projects });
    }
    catch (err) {
        console.error("❌ Error fetching projects:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.getUserProjects = getUserProjects;
const deleteProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.params;
        const user = req.user;
        const userId = user._id.toString();
        if (!userId || !projectId) {
            res.status(400).json({ message: "Missing projectId or userId" });
            return;
        }
        // Check if project exists and belongs to user
        const project = yield Project_1.default.findById(projectId);
        if (!project || project.user.toString() !== userId) {
            res.status(404).json({ message: "Project not found or unauthorized" });
            return;
        }
        //Delete from Supabase
        const { error: supabaseError } = yield supabase_1.supabase
            .storage
            .from(process.env.SUPABASE_BUCKET_NAME)
            .remove([`${userId}/${projectId}.zip`]);
        if (supabaseError) {
            console.error("❌ Supabase deletion failed:", supabaseError.message);
            res.status(500).json({ message: "Failed to delete project zip from cloud" });
            return;
        }
        // Delete from DB
        yield project.deleteOne();
        // Delete from file system
        yield (0, project_service_3.deleteProjectService)(projectId);
        res.status(200).json({ message: "Project deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.deleteProject = deleteProject;
const getProjectById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const user = req.user;
    const userId = user._id.toString();
    try {
        const project = yield Project_1.default.findById(projectId);
        if (!project) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        res.status(200).json({ project });
    }
    catch (error) {
        console.error("Error fetching project:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.getProjectById = getProjectById;
const joinProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const userId = user._id.toString();
        const { projectId } = req.body;
        const project = yield Project_1.default.findById(projectId);
        if (!project) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        const alreadyCollaborator = project.members
            .map((id) => id.toString())
            .includes(userId);
        if (alreadyCollaborator) {
            res.status(400).json({ message: "You're already a collaborator" });
            return;
        }
        project.members.push(userId);
        yield project.save();
        res.status(200).json({ message: "Joined project successfully" });
        return;
    }
    catch (err) {
        console.error("Error joining project:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.joinProject = joinProject;
const leaveProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const userId = user._id.toString();
        const { projectId } = req.body;
        const project = yield Project_1.default.findById(projectId);
        if (!project) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        if (project.user.toString() === userId) {
            res.status(400).json({ message: "You cannot leave your own project" });
            return;
        }
        project.members = project.members.filter((id) => id.toString() !== userId);
        yield project.save();
        res.status(200).json({ message: "Left project successfully" });
    }
    catch (err) {
        console.error("Error leaving project:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.leaveProject = leaveProject;

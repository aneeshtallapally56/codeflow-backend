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
exports.updateFileContent = exports.getFilesByProject = exports.createFile = void 0;
const File_1 = __importDefault(require("../models/File"));
const createFile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, path, projectId } = req.body;
        const user = req.user;
        const userId = user._id.toString();
        if (!name || !path || !projectId) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }
        const newFile = yield File_1.default.create({
            name,
            path,
            projectId,
            lastEditedBy: userId,
        });
        const populatedFile = yield File_1.default.findById(newFile._id).populate("lastEditedBy", "username");
        res.status(201).json({ message: "File created", file: populatedFile });
    }
    catch (err) {
        console.error("Error creating file:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.createFile = createFile;
const getFilesByProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.params;
        const files = yield File_1.default.find({ project: projectId }).sort({ path: 1 });
        res.status(200).json({ files });
    }
    catch (err) {
        console.error("Error fetching files:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.getFilesByProject = getFilesByProject;
const updateFileContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { fileId } = req.params;
        const { content } = req.body;
        const user = req.user;
        const userId = user._id.toString();
        const file = yield File_1.default.findByIdAndUpdate(fileId, { content, lastEditedBy: user._id }, { new: true });
        if (!file) {
            res.status(404).json({ message: "File not found" });
            return;
        }
        const updatedFile = yield File_1.default.findById(fileId).populate("lastEditedBy", "username");
        res.status(200).json({ message: "File updated", updatedFile });
    }
    catch (err) {
        console.error("Error updating file:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.updateFileContent = updateFileContent;

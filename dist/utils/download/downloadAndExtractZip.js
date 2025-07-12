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
exports.downloadAndExtractZip = downloadAndExtractZip;
// utils/downloadAndExtractZip.ts
const fs_1 = __importDefault(require("fs"));
const unzipper_1 = __importDefault(require("unzipper"));
function downloadAndExtractZip(projectId, downloadUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const tmpDir = `/tmp/${projectId}`;
        const zipPath = `/tmp/${projectId}.zip`;
        // Remove existing directory if it exists but is empty or corrupted
        if (fs_1.default.existsSync(tmpDir)) {
            try {
                const files = fs_1.default.readdirSync(tmpDir);
                if (files.length === 0) {
                    fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
                }
                else {
                    console.log("⚠️ Project directory exists with content, skipping extraction.");
                    return;
                }
            }
            catch (err) {
                // If we can't read the directory, it's probably corrupted, so remove it
                fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
            }
        }
        const response = yield fetch(downloadUrl);
        if (!response.ok) {
            const text = yield response.text();
            console.error("❌ Failed to download zip:", text);
            throw new Error(`Download failed with status ${response.status}`);
        }
        const buffer = Buffer.from(yield response.arrayBuffer());
        // Ensure tmp directory exists
        if (!fs_1.default.existsSync('/tmp')) {
            fs_1.default.mkdirSync('/tmp', { recursive: true });
        }
        fs_1.default.writeFileSync(zipPath, buffer);
        try {
            // Create the extraction directory
            fs_1.default.mkdirSync(tmpDir, { recursive: true });
            yield fs_1.default.createReadStream(zipPath)
                .pipe(unzipper_1.default.Extract({ path: tmpDir }))
                .promise();
            // Verify extraction was successful
            const extractedFiles = fs_1.default.readdirSync(tmpDir);
            if (extractedFiles.length === 0) {
                throw new Error("Extraction resulted in empty directory");
            }
        }
        catch (err) {
            console.error("❌ Failed to extract zip:", err);
            // Clean up on failure
            if (fs_1.default.existsSync(tmpDir)) {
                fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
            }
            throw err;
        }
        finally {
            // Clean up zip file
            if (fs_1.default.existsSync(zipPath)) {
                fs_1.default.unlinkSync(zipPath);
            }
        }
    });
}

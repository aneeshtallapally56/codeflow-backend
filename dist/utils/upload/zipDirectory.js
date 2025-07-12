"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zipDirectory = zipDirectory;
const archiver_1 = __importDefault(require("archiver"));
const fs_1 = __importDefault(require("fs"));
function zipDirectory(sourceDir, outPath) {
    return new Promise((resolve, reject) => {
        const output = fs_1.default.createWriteStream(outPath);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        archive.glob('**/*', {
            cwd: sourceDir,
            ignore: ['node_modules/**', '.next/**', '.git/**'],
        });
        archive.finalize();
    });
}

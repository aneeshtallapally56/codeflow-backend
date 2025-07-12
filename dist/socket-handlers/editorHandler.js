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
exports.handleEditorSocketEvents = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const File_1 = __importDefault(require("../models/File"));
const User_1 = __importDefault(require("../models/User"));
const redis_1 = require("../utils/redis");
const lockManager_1 = require("../utils/lockManager");
const syncToSupabase_1 = require("../utils/sync/syncToSupabase");
const getFilePresenceKey = (projectId, filePath) => `file-users:${projectId}:${filePath}`;
const handleEditorSocketEvents = (socket, editorNamespace) => {
    const normalizedUserId = String(socket.userId);
    socket.on("joinProjectRoom", (_a) => __awaiter(void 0, [_a], void 0, function* ({ projectId }) {
        socket.join(projectId);
        try {
            const user = yield User_1.default.findById(normalizedUserId).select("username avatarUrl");
            if (!user)
                return;
            yield (0, redis_1.redisSadd)(`project-users:${projectId}`, normalizedUserId);
            editorNamespace.to(projectId).emit("userJoinedProject", {
                userId: normalizedUserId,
                username: user.username,
                avatarUrl: user.avatarUrl,
                socketId: socket.id,
            });
            const userIds = yield (0, redis_1.redisSmembers)(`project-users:${projectId}`);
            const userMap = [];
            for (const id of userIds) {
                const u = yield User_1.default.findById(id).select("username avatarUrl");
                const sock = Array.from(editorNamespace.sockets.values()).find((s) => s.userId === id);
                userMap.push({
                    userId: id,
                    username: (u === null || u === void 0 ? void 0 : u.username) || "Unknown",
                    avatarUrl: (u === null || u === void 0 ? void 0 : u.avatarUrl) || "",
                    socketId: (sock === null || sock === void 0 ? void 0 : sock.id) || "",
                });
            }
            socket.emit("initialUsers", userMap);
        }
        catch (err) {
            console.error("Error in joinProjectRoom", err);
        }
    }));
    socket.on("leaveProjectRoom", (_a) => __awaiter(void 0, [_a], void 0, function* ({ projectId }) {
        socket.leave(projectId);
        yield (0, redis_1.redisSrem)(`project-users:${projectId}`, normalizedUserId);
        editorNamespace.to(projectId).emit("userLeftProject", {
            userId: normalizedUserId,
            socketId: socket.id,
        });
    }));
    socket.on("joinFileRoom", (_a) => __awaiter(void 0, [_a], void 0, function* ({ projectId, filePath }) {
        socket.join(`${projectId}:${filePath}`);
        try {
            const lockHolder = yield (0, lockManager_1.getFileLock)(filePath);
            yield (0, redis_1.redisSadd)(getFilePresenceKey(projectId, filePath), normalizedUserId);
            const user = yield User_1.default.findById(normalizedUserId).select("username avatarUrl");
            editorNamespace.to(`${projectId}:${filePath}`).emit("userJoinedFile", {
                userId: normalizedUserId,
                username: (user === null || user === void 0 ? void 0 : user.username) || "Unknown",
                avatarUrl: (user === null || user === void 0 ? void 0 : user.avatarUrl) || "",
                socketId: socket.id,
                filePath,
            });
            const fileUserIds = yield (0, redis_1.redisSmembers)(getFilePresenceKey(projectId, filePath));
            const users = [];
            for (const id of fileUserIds) {
                const u = yield User_1.default.findById(id).select("username avatarUrl");
                const sock = Array.from(editorNamespace.sockets.values()).find((s) => s.userId === id);
                users.push({
                    userId: id,
                    username: (u === null || u === void 0 ? void 0 : u.username) || "Unknown",
                    avatarUrl: (u === null || u === void 0 ? void 0 : u.avatarUrl) || "",
                    socketId: (sock === null || sock === void 0 ? void 0 : sock.id) || "",
                });
            }
            socket.emit("initialFileUsers", { filePath, users });
            if (lockHolder) {
                // Parse the lockHolder if it's a JSON string
                let actualUserId = lockHolder;
                // Check if lockHolder is a JSON string and parse it
                if (typeof lockHolder === 'string' && lockHolder.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(lockHolder);
                        actualUserId = parsed.userId;
                    }
                    catch (error) {
                        console.error("Error parsing lockHolder:", error);
                        actualUserId = lockHolder; // fallback to original value
                    }
                }
                socket.emit("fileLocked", { filePath, userId: actualUserId });
                socket.emit("initialFileLocks", {
                    fileLocks: {
                        [filePath]: actualUserId, // Send the actual userId, not JSON string
                    },
                });
            }
        }
        catch (error) {
            console.error("Error in joinFileRoom", error);
        }
    }));
    socket.on("leaveFileRoom", (_a) => __awaiter(void 0, [_a], void 0, function* ({ projectId, filePath }) {
        socket.leave(`${projectId}:${filePath}`);
        yield (0, redis_1.redisSrem)(getFilePresenceKey(projectId, filePath), normalizedUserId);
        editorNamespace.to(`${projectId}:${filePath}`).emit("userLeftFile", {
            userId: normalizedUserId,
            filePath,
        });
        const currentLockHolder = yield (0, lockManager_1.getFileLock)(filePath);
        let actualUserId = currentLockHolder;
        if (typeof currentLockHolder === "string" && currentLockHolder.startsWith("{")) {
            try {
                const parsed = JSON.parse(currentLockHolder);
                actualUserId = parsed.userId;
            }
            catch (e) {
                console.error("Failed to parse file lock holder", e);
            }
        }
        if (actualUserId === normalizedUserId) {
            yield (0, redis_1.redisDel)(`file-lock:${filePath}`);
            editorNamespace.to(`${projectId}:${filePath}`).emit("fileUnlocked", { filePath });
        }
    }));
    socket.on("writeFile", (_a) => __awaiter(void 0, [_a], void 0, function* ({ data, filePath, projectId }) {
        try {
            yield promises_1.default.writeFile(filePath, data);
            editorNamespace.to(`${projectId}:${filePath}`).emit("writeFileSuccess", {
                data: "File written successfully",
                filePath,
            });
        }
        catch (_b) {
            socket.emit("error", { data: "Error writing the file" });
        }
    }));
    socket.on("createFile", (_a) => __awaiter(void 0, [_a], void 0, function* ({ filePath, projectId }) {
        try {
            yield promises_1.default.writeFile(filePath, "");
            yield File_1.default.create({
                name: path_1.default.basename(filePath),
                path: filePath,
                projectId,
                lastEditedBy: normalizedUserId,
            });
            socket.emit("createFileSuccess", { data: "File created successfully" });
            editorNamespace.to(projectId).emit("fileCreated", { path: filePath });
        }
        catch (error) {
            socket.emit("error", { data: "Error creating the file" });
        }
    }));
    socket.on("readFile", (_a) => __awaiter(void 0, [_a], void 0, function* ({ filePath }) {
        try {
            const content = yield promises_1.default.readFile(filePath);
            socket.emit("readFileSuccess", {
                value: content.toString(),
                filePath,
                extension: path_1.default.extname(filePath),
            });
        }
        catch (_b) {
            socket.emit("error", { data: "Error reading the file" });
        }
    }));
    socket.on("deleteFile", (_a) => __awaiter(void 0, [_a], void 0, function* ({ filePath, projectId }) {
        try {
            yield promises_1.default.unlink(filePath);
            editorNamespace.to(projectId).emit("fileDeleted", { path: filePath });
            socket.emit("deleteFileSuccess", { data: "File deleted" });
        }
        catch (_b) {
            socket.emit("error", { data: "Failed to delete file" });
        }
    }));
    socket.on("createFolder", (_a) => __awaiter(void 0, [_a], void 0, function* ({ filePath, projectId }) {
        try {
            yield promises_1.default.mkdir(filePath, { recursive: true });
            socket.emit("createFolderSuccess", { data: "Folder created successfully" });
            editorNamespace.to(projectId).emit("folderCreated", { path: filePath });
        }
        catch (error) {
            socket.emit("error", { data: "Error creating the folder", error: String(error) });
        }
    }));
    socket.on("deleteFolder", (_a) => __awaiter(void 0, [_a], void 0, function* ({ filePath, projectId }) {
        try {
            yield promises_1.default.rm(filePath, { recursive: true, force: true });
            editorNamespace.to(projectId).emit("folderDeleted", { path: filePath });
            socket.emit("deleteFolderSuccess", { data: "Folder deleted successfully" });
        }
        catch (_b) {
            socket.emit("error", { data: "Error deleting the folder" });
        }
    }));
    socket.on("lockFile", (_a) => __awaiter(void 0, [_a], void 0, function* ({ projectId, filePath }) {
        const key = `file-lock:${filePath}`;
        const userId = String(socket.userId); // ✅ SAFE user ID
        const success = yield (0, redis_1.redisSet)(key, JSON.stringify({ userId }), "EX", 300, "NX");
        if (success) {
            editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", {
                filePath,
                userId,
            });
        }
        else {
            const current = yield (0, redis_1.redisGet)(key);
            if (current) {
                const { userId: currentHolder } = JSON.parse(current);
                socket.emit("fileLocked", { filePath, userId: currentHolder });
            }
        }
    }));
    socket.on("transferLock", (_a) => __awaiter(void 0, [_a], void 0, function* ({ filePath, projectId, toUserId }) {
        const lockKey = `file-lock:${filePath}`;
        const rawValue = yield (0, redis_1.redisGet)(lockKey);
        if (!rawValue) {
            return socket.emit("error", { message: "No lock found to transfer" });
        }
        let currentHolder;
        try {
            currentHolder = JSON.parse(rawValue);
        }
        catch (err) {
            console.error("Failed to parse lock value from Redis:", rawValue);
            return socket.emit("error", { message: "Lock data corrupted" });
        }
        if (currentHolder.userId !== normalizedUserId) {
            return socket.emit("error", { message: "You don't hold the lock" });
        }
        yield (0, redis_1.redisSet)(lockKey, JSON.stringify({ userId: String(toUserId) }), "EX", 300);
        editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", {
            filePath,
            userId: String(toUserId),
        });
    }));
    socket.on("requestLock", (_a) => __awaiter(void 0, [_a], void 0, function* ({ filePath, projectId }) {
        const fileRoom = `${projectId}:${filePath}`;
        const user = yield User_1.default.findById(normalizedUserId).select("username");
        editorNamespace.to(fileRoom).emit("fileLockRequested", {
            filePath,
            projectId,
            requestedBy: (user === null || user === void 0 ? void 0 : user.username) || "Unknown",
            requesterUserId: normalizedUserId,
        });
    }));
    socket.on("disconnect", () => __awaiter(void 0, void 0, void 0, function* () {
        const keys = yield (0, redis_1.redisKeys)("file-lock:*");
        for (const key of keys) {
            const value = yield (0, redis_1.redisGet)(key);
            if (!value)
                continue;
            const { userId } = JSON.parse(value);
            if (userId === normalizedUserId) {
                yield (0, redis_1.redisDel)(key);
                const [_, projectId, ...filePathParts] = key.split(":");
                const filePath = filePathParts.join(":");
                editorNamespace.to(`${projectId}:${filePath}`).emit("fileUnlocked", { filePath });
            }
        }
        const fileKeys = yield (0, redis_1.redisKeys)("file-users:*");
        for (const key of fileKeys) {
            const isPresent = yield (0, redis_1.redisSismember)(key, normalizedUserId);
            if (isPresent) {
                yield (0, redis_1.redisSrem)(key, normalizedUserId);
                const [_, projectId, ...filePathParts] = key.split(":");
                const filePath = filePathParts.join(":");
                editorNamespace.to(`${projectId}:${filePath}`).emit("fileUserLeft", {
                    userId: normalizedUserId,
                });
            }
        }
        if (socket.projectId) {
            yield (0, syncToSupabase_1.syncProjectToSupabase)(socket.projectId, normalizedUserId);
        }
    }));
};
exports.handleEditorSocketEvents = handleEditorSocketEvents;

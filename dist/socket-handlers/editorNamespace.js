"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.setupEditorNamespace = setupEditorNamespace;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cookie = __importStar(require("cookie"));
const editorHandler_1 = require("./editorHandler");
const redis_1 = __importDefault(require("../utils/redis"));
const handleContainerCreate_1 = require("../controllers/containers/handleContainerCreate");
function setupEditorNamespace(io) {
    const editorNamespace = io.of("/editor");
    // 🔐 Middleware: Attach userId from JWT
    editorNamespace.use((socket, next) => {
        const rawCookie = socket.handshake.headers.cookie;
        const parsed = cookie.parse(rawCookie || "");
        const token = parsed.token;
        if (!token) {
            return next(new Error("Authentication error"));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        }
        catch (err) {
            console.error("Token error", err);
            return next(new Error("Authentication failed"));
        }
    });
    // ⚡ On connection
    editorNamespace.on("connection", (socket) => __awaiter(this, void 0, void 0, function* () {
        const queryParams = socket.handshake.query;
        const projectId = queryParams.projectId;
        const userId = socket.userId;
        socket.projectId = projectId;
        if (!projectId || !userId) {
            socket.disconnect();
            return;
        }
        // ✅ Join project room
        socket.join(projectId);
        // ✅ Register in Redis
        yield redis_1.default.sadd(`project-users:${projectId}`, userId);
        // ✅ Fetch current users from Redis
        const liveUserIds = yield redis_1.default.smembers(`project-users:${projectId}`);
        socket.emit("initialUsers", liveUserIds);
        // 📦 Editor-related event handlers
        (0, editorHandler_1.handleEditorSocketEvents)(socket, editorNamespace);
        // 🛠 Terminal port support
        socket.on("getPort", (projectId) => __awaiter(this, void 0, void 0, function* () {
            const containerPort = yield (0, handleContainerCreate_1.getContainerPort)(`project-${projectId}`);
            socket.emit("getPortSuccess", {
                port: containerPort,
            });
        }));
        // 🔌 Handle disconnect
        socket.on("disconnect", () => __awaiter(this, void 0, void 0, function* () {
            // 🧹 Remove from Redis
            yield redis_1.default.srem(`project-users:${projectId}`, userId);
            // 🔄 Notify others
            editorNamespace.to(projectId).emit("userLeft", {
                userId,
                socketId: socket.id,
            });
            // 🔄 Remove from all file rooms this user joined
            const keys = yield redis_1.default.keys(`project-users:${projectId}:*`);
            for (const key of keys) {
                yield redis_1.default.srem(key, userId);
                const filePath = key.replace(`project-users:${projectId}:`, "");
                editorNamespace.to(`${projectId}:${filePath}`).emit("fileUserLeft", {
                    userId,
                    filePath,
                    socketId: socket.id,
                });
            }
        }));
    }));
}

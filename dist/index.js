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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dockerode_1 = __importDefault(require("dockerode"));
const config_1 = require("./config");
const db_config_1 = require("./config/db-config");
const routes_1 = __importDefault(require("./routes"));
const editorNamespace_1 = require("./socket-handlers/editorNamespace");
const handleContainerCreate_1 = require("./controllers/containers/handleContainerCreate");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Initialize Docker client only if Docker is available
let dockerClient = null;
try {
    dockerClient = new dockerode_1.default();
}
catch (error) {
    console.warn('⚠️ Docker not available, terminal features will be disabled');
}
// --- Middleware ---
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Production-ready CORS
const allowedOrigins = ((_a = process.env.ALLOWED_ORIGINS) === null || _a === void 0 ? void 0 : _a.split(',')) || [
    'http://localhost:3000',
    'https://codeflow-six.vercel.app'
];
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// Health check endpoint
app.get("/api/health", (_, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// --- MongoDB + REST API ---
(0, db_config_1.connectDB)();
app.use('/api', routes_1.default);
// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});
// --- Socket.IO Setup ---
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});
(0, editorNamespace_1.setupEditorNamespace)(io);
io.on('connection', (socket) => {
    console.log('✅ Backend received a Socket.IO connection');
});
// --- Terminal WebSocket Setup ---
const wss = new ws_1.WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const isTerminal = (_a = req.url) === null || _a === void 0 ? void 0 : _a.startsWith('/terminal');
    if (!isTerminal)
        return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const projectId = url.searchParams.get('projectId');
    if (!projectId) {
        socket.destroy();
        return;
    }
    // Check if Docker is available
    if (!dockerClient) {
        socket.destroy();
        return;
    }
    // WAIT for container creation to complete before proceeding
    yield (0, handleContainerCreate_1.handleContainerCreate)(projectId);
    wss.handleUpgrade(req, socket, head, (ws) => {
        handleTerminalSocket(ws, projectId);
    });
}));
const handleTerminalSocket = (ws, projectId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!dockerClient) {
        ws.close();
        return;
    }
    try {
        const container = dockerClient.getContainer(`project-${projectId}`);
        // Wait for container to be ready for exec
        yield new Promise(resolve => setTimeout(resolve, 1500));
        const exec = yield container.exec({
            Cmd: ['/bin/bash'],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
        });
        const stream = yield exec.start({ hijack: true, stdin: true });
        // Pipe: container → client
        stream.on('data', (data) => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(data.toString());
            }
        });
        // Pipe: client → container
        ws.on('message', (msg) => {
            stream.write(msg);
        });
        ws.on('close', () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                stream.destroy();
            }
            catch (err) {
                console.error(`❌ Error removing container:`, err);
            }
        }));
    }
    catch (err) {
        console.error(`❌ Error handling terminal WebSocket for ${projectId}:`, err);
        ws.close();
    }
});
// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
const PORT = config_1.serverConfig.PORT || 3002;
server.listen(PORT, () => {
    console.log(`✅ Backend is running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

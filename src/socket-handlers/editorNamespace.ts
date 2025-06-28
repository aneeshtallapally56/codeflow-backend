// src/socket-handlers/editorNamespace.ts
import chokidar, { FSWatcher } from "chokidar";
import path from "path";
import jwt from "jsonwebtoken";
import { Socket, Server } from "socket.io";
import * as cookie from "cookie";
import { handleEditorSocketEvents } from "./editorHandler";

const watchers = new Map<string, FSWatcher>();
const projectUsers = new Map<string, Set<string>>(); 


export function setupEditorNamespace(io: Server) {
  const editorNamespace = io.of("/editor");

  // Middleware to verify JWT and attach userId
  editorNamespace.use((socket, next) => {
    const rawCookie = socket.handshake.headers.cookie;
    const parsed = cookie.parse(rawCookie || "");
    const token = parsed.token;

    if (!token) {
      return next(new Error("Authentication error"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      (socket as any).userId = decoded.userId; // Attach to socket
      next();
    } catch (err) {
      console.error("Token error", err);
      return next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  editorNamespace.on("connection", (socket: Socket) => {
    const queryParams = socket.handshake.query;
    const projectId = queryParams.projectId as string;
    const userId = (socket as any).userId;

    // ✅ Join socket room for project
    socket.join(projectId);

    // ✅ Track live users
    if (!projectUsers.has(projectId)) {
      projectUsers.set(projectId, new Set());
    }
    projectUsers.get(projectId)!.add(userId);

    const clientsInRoom = Array.from(
      editorNamespace.adapter.rooms.get(projectId) || []
    );
    const currentUsers = clientsInRoom.map((socketId) => {
      const s = editorNamespace.sockets.get(socketId);
      return {
        userId: (s as any).userId,
        socketId,
      };
    });
    socket.emit("initialUsers", currentUsers);

    // File Watcher Setup (optional)
    if (projectId) {
      const projectPath = path.join(
        process.cwd(),
        "generated-projects",
        projectId
      );
      const watcher = chokidar.watch(projectPath, {
        ignored: (filePath) => filePath.includes("node_modules"),
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100,
        },
      });

      watcher.on("all", (event, filePath) => {
        console.log(`📁 File ${filePath} ${event}`);
      });

      watchers.set(socket.id, watcher);
    }

    // File-related event handlers
    handleEditorSocketEvents(socket, editorNamespace);

    // 🔌 Disconnect cleanup
    socket.on("disconnect", async () => {
      console.log(`🔌 Disconnected: ${socket.id}`);

      // Stop watcher
      const watcher = watchers.get(socket.id);
      if (watcher) await watcher.close();
      watchers.delete(socket.id);

      // Remove from project users
      const users = projectUsers.get(projectId);
      if (users) {
        users.delete(userId);
        if (users.size === 0) {
          projectUsers.delete(projectId);
        }
      }

      // Notify others
      editorNamespace.to(projectId).emit("userLeft", {
        userId,
        socketId: socket.id,
      });
    });
  });
}

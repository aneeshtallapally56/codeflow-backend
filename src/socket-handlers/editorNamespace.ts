// src/socket-handlers/editorNamespace.ts
import chokidar, { FSWatcher } from "chokidar";
import path from "path";
import jwt from "jsonwebtoken";
import { Socket, Server } from "socket.io";
import * as cookie from "cookie";
import { handleEditorSocketEvents } from "./editorHandler";
import User from "../models/User";
import redis from "../utils/redis"; // ✅ make sure path is correct
import { getContainerPort, listContainers } from "../containers/handleContainerCreate";

const watchers = new Map<string, FSWatcher>();

export function setupEditorNamespace(io: Server) {
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      (socket as any).userId = decoded.userId;
      next();
    } catch (err) {
      console.error("Token error", err);
      return next(new Error("Authentication failed"));
    }
  });

  // ⚡ On connection
  editorNamespace.on("connection", async (socket: Socket) => {
    const queryParams = socket.handshake.query;
    const projectId = queryParams.projectId as string;
    const userId = (socket as any).userId;

    if (!projectId || !userId) {
      socket.disconnect();
      return;
    }

    // ✅ Join project room
    socket.join(projectId);

    // ✅ Register in Redis
    await redis.sadd(`project-users:${projectId}`, userId);

    // ✅ Fetch current users from Redis
    const liveUserIds = await redis.smembers(`project-users:${projectId}`);
    socket.emit("initialUsers", liveUserIds);

    // 📦 Editor-related event handlers
    handleEditorSocketEvents(socket, editorNamespace);

    //to get port from the frontend
    socket.on('getPort',async (projectId)=>{
      const containerPort = await getContainerPort(`project-${projectId}`);
      socket.emit('getPortSuccess',{
        port: containerPort
      })
    })
    // 📁 Optional: Set up project file watcher
    const projectPath = path.join(process.cwd(), "generated-projects", projectId);
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

    // 🔌 Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`🔌 Disconnected: ${socket.id}`);

      // 🧹 Cleanup watcher
      const watcher = watchers.get(socket.id);
      if (watcher) await watcher.close();
      watchers.delete(socket.id);

      // 🧹 Remove from Redis
      await redis.srem(`project-users:${projectId}`, userId);

      // 🔄 Notify others
      editorNamespace.to(projectId).emit("userLeft", {
        userId,
        socketId: socket.id,
      });

      // 🔄 Remove from all file rooms this user joined
      const keys = await redis.keys(`project-users:${projectId}:*`);
      for (const key of keys) {
        await redis.srem(key, userId);
        const filePath = key.replace(`project-users:${projectId}:`, "");
        editorNamespace.to(`${projectId}:${filePath}`).emit("fileUserLeft", {
          userId,
          filePath,
          socketId: socket.id,
        });
      }
    });
  });
}
// src/socket-handlers/editorNamespace.ts
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import jwt from 'jsonwebtoken';
import { Socket, Server } from 'socket.io';

import * as cookie from 'cookie';
import { handleEditorSocketEvents } from './editorHandler';

const watchers = new Map<string, FSWatcher>();

export function setupEditorNamespace(io: Server) {
  const editorNamespace = io.of('/editor');

  editorNamespace.use((socket, next) => {
    const rawCookie = socket.handshake.headers.cookie;
    const parsed = cookie.parse(rawCookie || "");
    const token = parsed.token;

    if (!token) {
      return next(new Error("Authentication error"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      console.error("Token error", err);
      return next(new Error("Authentication failed"));
    }
  });

  editorNamespace.on('connection', (socket: Socket) => {
    const queryParams = socket.handshake.query;
    const projectId = queryParams.projectId as string;

    if (projectId) {
      const projectPath = path.join(process.cwd(), "generated-projects", projectId);

      const watcher = chokidar.watch(projectPath, {
        ignored: (path) => path.includes("node_modules"),
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      watcher.on("all", (event, filePath) => {
        console.log(`File ${filePath} has been ${event}`);
      });

      watchers.set(socket.id, watcher);
    }

    handleEditorSocketEvents(socket, editorNamespace);

    socket.on('disconnect', async () => {
      const watcher = watchers.get(socket.id);
      if (watcher) await watcher.close();
      watchers.delete(socket.id);
      console.log("Disconnected and watcher closed");
    });
  });
}
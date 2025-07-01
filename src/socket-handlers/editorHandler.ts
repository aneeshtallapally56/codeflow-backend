import fs from "fs/promises";
import path from "path";
import { Socket } from "socket.io";
import File from "../models/File";
import User from "../models/User";
import redis from "../utils/redis";

const getLockKey = (projectId: string, filePath: string) => `file-lock:${projectId}:${filePath}`;
const getFilePresenceKey = (projectId: string, filePath: string) => `file-users:${projectId}:${filePath}`;

type FilePayload = { filePath: string };
type WriteFilePayload = { filePath: string; data: string };
type DeletePayload = { filePath: string; projectId: string };

export const handleEditorSocketEvents = (socket: Socket, editorNamespace: any) => {
  socket.on("joinProjectRoom", async ({ projectId }) => {
    socket.join(projectId);
    try {
      const user = await User.findById(socket.userId).select("username");
      if (!socket.userId) return;

      await redis.sadd(`project-users:${projectId}`, socket.userId);

      editorNamespace.to(projectId).emit("userJoinedProject", {
        userId: socket.userId,
        username: user?.username || "Unknown",
        socketId: socket.id,
      });

      const userIds = await redis.smembers(`project-users:${projectId}`);
      const userMap = [];

      for (const id of userIds) {
        const u = await User.findById(id).select("username");
        const sock = Array.from(editorNamespace.sockets.values()).find(s => (s as Socket).userId === id) as Socket | undefined;
        userMap.push({
          userId: id,
          username: u?.username || "Unknown",
          socketId: sock?.id || "",
        });
      }

      socket.emit("initialUsers", userMap);
    } catch (err) {
      console.error("Error in joinProjectRoom", err);
    }
  });

  socket.on("leaveProjectRoom", async ({ projectId }) => {
    socket.leave(projectId);
    if (!socket.userId) return;
    await redis.srem(`project-users:${projectId}`, socket.userId);
    editorNamespace.to(projectId).emit("userLeftProject", {
      userId: socket.userId,
      socketId: socket.id,
    });
  });

  socket.on("joinFileRoom", async ({ projectId, filePath }) => {
    socket.join(`${projectId}:${filePath}`);
    try {
      if (!socket.userId) return;

      const user = await User.findById(socket.userId).select("username");
      await redis.sadd(getFilePresenceKey(projectId, filePath), socket.userId);

      editorNamespace.to(`${projectId}:${filePath}`).emit("UserJoinedFile", {
        userId: socket.userId,
        username: user?.username || "Unknown",
        socketId: socket.id,
      });

      const fileUserIds = await redis.smembers(getFilePresenceKey(projectId, filePath));
      const users = [];

      for (const id of fileUserIds) {
        const u = await User.findById(id).select("username");
        const sock = Array.from(editorNamespace.sockets.values()).find(s => (s as Socket).userId === id) as Socket | undefined;
        users.push({
          userId: id,
          username: u?.username || "Unknown",
          socketId: sock?.id || "",
        });
      }

      socket.emit("initialFileUsers", users);

 
    } catch (error) {
      console.error("Error in joinFileRoom", error);
    }
  });

  socket.on("leaveFileRoom", async ({ projectId, filePath }) => {
    socket.leave(`${projectId}:${filePath}`);
    const userId = socket.userId;
    if (!userId) return;

    await redis.srem(getFilePresenceKey(projectId, filePath), userId);

    editorNamespace.to(`${projectId}:${filePath}`).emit("fileUserLeft", {
      userId: socket.userId,
    });
  });

  socket.on("lockFile", async ({ projectId, filePath, requestId }) => {
    try {
      const key = getLockKey(projectId, filePath);
      const lockExists = await redis.get(key);
      const user = await User.findById(socket.userId).select("username");

      if (lockExists) {
        const existingLock = JSON.parse(lockExists);
        if (existingLock.userId === socket.userId) {
          socket.emit("fileLockGranted", { userId: socket.userId, username: user?.username || "Unknown", filePath, requestId });
          editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", { userId: socket.userId, username: user?.username || "Unknown", filePath });
        } else {
          socket.emit("fileLockDenied", { userId: existingLock.userId, username: existingLock.username, filePath, requestId });
          socket.emit("fileLockedByOther", { userId: existingLock.userId, username: existingLock.username, filePath });
        }
      } else {
        const locker = { userId: socket.userId, username: user?.username || "Unknown" };
        await redis.set(key, JSON.stringify(locker), "EX", 300);
        editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", { ...locker, filePath });
        socket.emit("fileLockGranted", { ...locker, filePath, requestId });
      }
    } catch (error) {
      socket.emit("lockError", { error: "Failed to acquire lock", requestId, filePath });
    }
  });

  socket.on("unlockFile", async ({ projectId, filePath }) => {
    try {
      const key = getLockKey(projectId, filePath);
      const lockData = await redis.get(key);
      if (lockData) {
        const lock = JSON.parse(lockData);
        if (lock.userId === socket.userId) {
          await redis.del(key);
          editorNamespace.to(`${projectId}:${filePath}`).emit("fileUnlocked", { filePath });
          socket.emit("fileLockReleased", { filePath });
        }
      }
    } catch (error) {
      socket.emit("lockError", { error: "Failed to release lock", filePath });
    }
  });

  socket.on("transferFileLock", async ({ projectId, filePath, newUserId }) => {
    try {
      const key = getLockKey(projectId, filePath);
      const currenUserId = socket.userId;
      const lockData = await redis.get(key);
         if (!lockData) return;
         const lock = JSON.parse(lockData);
      if (lock.userId === !currenUserId) {
         return socket.emit("fileLockDenied", {
        filePath,
        username: lock.username,
        reason: "You don't hold the lock",
      });
      }
      //have to check if new user exists in the socket 
    const socketsInRoom = await editorNamespace.in(filePath).fetchSockets();
    const targetSocket: Socket & { userId?: string; username?: string } | undefined = socketsInRoom.find((s: Socket & { userId?: string }) => s.userId === newUserId);

    if (!targetSocket) {
      return socket.emit("fileLockDenied", {
        filePath,
        username: "Unknown",
        reason: "Target user is not connected",
      });
    }
       const targetUsername = targetSocket.username;
       const newLock = JSON.stringify({
      userId: newUserId,
      username: targetUsername,
    });
 await redis.set(key, newLock, "EX", 60 * 5); 
editorNamespace.to(`${projectId}:${filePath}`).emit("unlockFile", { projectId, filePath });
targetSocket.emit("fileLockGranted",{
      filePath,
      userId: newUserId,
      username: targetUsername,
    });
 socket.emit("fileLockedByOther", {
      filePath,
      userId: newUserId,
      username: targetUsername,
    });

    } catch (error) {
     console.error("Error in transferFileLock:", error);
    socket.emit("fileLockDenied", {
      filePath,
      username: "unknown",
      reason: "Internal error",
    });
    }
  });
  socket.on("writeFile", async ({ data, filePath, projectId }: WriteFilePayload & { projectId: string }) => {
    try {
      await fs.writeFile(filePath, data);
      editorNamespace.to(`${projectId}:${filePath}`).emit("writeFileSuccess", { data: "File written successfully", filePath });
    } catch {
      socket.emit("error", { data: "Error writing the file" });
    }
  });

  socket.on("createFile", async ({ filePath, projectId }) => {
    try {
      await fs.writeFile(filePath, "");
      await File.create({ name: path.basename(filePath), path: filePath, projectId, lastEditedBy: socket.userId });
      socket.emit("createFileSuccess", { data: "File created successfully" });
      editorNamespace.to(projectId).emit("fileCreated", { path: filePath });
    } catch (error) {
      socket.emit("error", { data: "Error creating the file" });
    }
  });

  socket.on("readFile", async ({ filePath }: FilePayload) => {
    try {
      const content = await fs.readFile(filePath);
      socket.emit("readFileSuccess", { value: content.toString(), filePath, extension: path.extname(filePath) });
    } catch {
      socket.emit("error", { data: "Error reading the file" });
    }
  });

  socket.on("deleteFile", async ({ filePath, projectId }: DeletePayload) => {
    try {
      await fs.unlink(filePath);
      editorNamespace.to(projectId).emit("fileDeleted", { path: filePath });
      socket.emit("deleteFileSuccess", { data: "File deleted" });
    } catch {
      socket.emit("error", { data: "Failed to delete file" });
    }
  });

  socket.on("createFolder", async ({ filePath, projectId }) => {
    try {
      await fs.mkdir(filePath, { recursive: true });
      socket.emit("createFolderSuccess", { data: "Folder created successfully" });
      editorNamespace.to(projectId).emit("folderCreated", { path: filePath });
    } catch {
      socket.emit("error", { data: "Error creating the folder" });
    }
  });

  socket.on("deleteFolder", async ({ filePath, projectId }: DeletePayload) => {
    try {
      await fs.rm(filePath, { recursive: true, force: true });
      editorNamespace.to(projectId).emit("folderDeleted", { path: filePath });
      socket.emit("deleteFolderSuccess", { data: "Folder deleted successfully" });
    } catch {
      socket.emit("error", { data: "Error deleting the folder" });
    }
  });

  socket.on("disconnect", async () => {
    const keys = await redis.keys("file-lock:*");
    for (const key of keys) {
      const value = await redis.get(key);
      if (!value) continue;
      const { userId } = JSON.parse(value);
      if (userId === socket.userId) {
        await redis.del(key);
        const [_, projectId, ...filePathParts] = key.split(":");
        const filePath = filePathParts.join(":");
        editorNamespace.to(`${projectId}:${filePath}`).emit("fileUnlocked", { filePath });
      }
    }

    const fileKeys = await redis.keys("file-users:*");
    for (const key of fileKeys) {
      const userId = socket.userId;
      if (!userId) return;
      const isPresent = await redis.sismember(key, userId);
      if (isPresent) {
        await redis.srem(key, userId);
        const [_, projectId, ...filePathParts] = key.split(":");
        const filePath = filePathParts.join(":");
        editorNamespace.to(`${projectId}:${filePath}`).emit("fileUserLeft", { userId: socket.userId });
      }
    }
  });
};
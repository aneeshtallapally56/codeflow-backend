import fs from "fs/promises";
import path from "path";
import { Socket } from "socket.io";
import File from "../models/File";
import User from "../models/User";
import redis from "../utils/redis";
import { getFileLock } from "../utils/lockManager";


const getFilePresenceKey = (projectId: string, filePath: string) => `file-users:${projectId}:${filePath}`;

type FilePayload = { filePath: string };
type WriteFilePayload = { filePath: string; data: string };
type DeletePayload = { filePath: string; projectId: string };

export const handleEditorSocketEvents = (socket: Socket, editorNamespace: any) => {
   const userId = (socket as any).userId;
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

 // JOIN FILE ROOM
socket.on("joinFileRoom", async ({ projectId, filePath }) => {
  socket.join(`${projectId}:${filePath}`);
  try {
    if (!socket.userId) return;

    // ✅ Get lock holder (await it)
    const lockHolder = await getFileLock(filePath);

    // ✅ Add user to file presence set
    await redis.sadd(getFilePresenceKey(projectId, filePath), socket.userId);

    // ✅ Get current user's name
    const user = await User.findById(socket.userId).select("username");

    // ✅ Broadcast user joined to file room
    editorNamespace.to(`${projectId}:${filePath}`).emit("userJoinedFile", {
      userId: socket.userId,
      username: user?.username || "Unknown",
      socketId: socket.id,
      filePath
    });

    // ✅ Send initial file users list to the new user
    const fileUserIds = await redis.smembers(getFilePresenceKey(projectId, filePath));
    const users = [];

    for (const id of fileUserIds) {
      const u = await User.findById(id).select("username");
      const sock = Array.from(editorNamespace.sockets.values()).find(
        (s) => (s as Socket).userId === id
      ) as Socket | undefined;

      users.push({
        userId: id,
        username: u?.username || "Unknown",
        socketId: sock?.id || "",
      });
    }

    socket.emit("initialFileUsers", { filePath, users });

    // ✅ Send current lock holder to the new user
    if (lockHolder) {
      socket.emit("fileLocked", { filePath, userId: lockHolder });
    }

  } catch (error) {
    console.error("Error in joinFileRoom", error);
  }
});

  socket.on("leaveFileRoom", async ({ projectId, filePath }) => {
  socket.leave(`${projectId}:${filePath}`);
  console.log(`User ${socket.userId} left file room: ${projectId}:${filePath}`);
  const userId = socket.userId;
  if (!userId) return;

  // ✅ Remove from file presence set
  await redis.srem(getFilePresenceKey(projectId, filePath), userId);

  // ✅ Broadcast that user left the file
  editorNamespace.to(`${projectId}:${filePath}`).emit("userLeftFile", {
    userId,
    filePath
  });

  // ✅ Check if this user holds the lock
  const currentLockHolder = await getFileLock(filePath);
  if (currentLockHolder === userId) {
    await redis.del(`file-lock:${filePath}`);
    editorNamespace.to(`${projectId}:${filePath}`).emit("fileUnlocked", {
      filePath,
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
    } catch(error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      socket.emit("error", { data: "Error creating the folder", error: errorMessage });
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

  socket.on("lockFile", async ({ projectId, filePath, userId }) => {
  const key = `file-lock:${filePath}`;
  const success = await (redis as any).set(key, JSON.stringify({ userId }), "NX", "EX", 300);

  if (success) {
    editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", {
      filePath,
      userId,
    });
  } else {
    // optionally emit current lock holder
    const current = await redis.get(key);
    if (current) {
      const { userId: currentHolder } = JSON.parse(current);
      socket.emit("fileLocked", { filePath, userId: currentHolder });
    }
  }
});
 socket.on("transferLock", async ({ filePath, projectId, toUserId }) => {
    const lockKey = `file-lock:${filePath}`;
     const rawValue = await redis.get(lockKey);

  if (!rawValue) {
    return socket.emit("error", { message: "No lock found to transfer" });
  }
let currentHolder;
 try {
    currentHolder = JSON.parse(rawValue);
  } catch (err) {
    console.error("Failed to parse lock value from Redis:", rawValue);
    return socket.emit("error", { message: "Lock data corrupted" });
  }
    console.log(`Transfer request - Current holder: ${currentHolder}, Socket user: ${userId}`);
    
    if (currentHolder.userId !== userId) {
      console.log(currentHolder, userId);
      return socket.emit("error", { message: "You don't hold the lock" });
    }

    await redis.set(lockKey,JSON.stringify({ userId: toUserId }), "EX", 300); // renew lock for 5 minutes
    editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", {
      filePath,
      userId: toUserId,
    });
    
    console.log(`Lock transferred from ${userId} to ${toUserId} for file ${filePath}`);
  });
socket.on("requestLock", ({ filePath, projectId }) => {
  const fileRoom = `${projectId}:${filePath}`;
  // Broadcast request to the current lock holder
  editorNamespace.to(fileRoom).emit("fileLockRequested", {
    filePath,
    projectId,
    requestedBy: socket.userId,
    requesterSocketId: socket.id,
  });
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
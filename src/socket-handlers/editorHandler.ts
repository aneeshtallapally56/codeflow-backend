import fs from "fs/promises";
import path from "path";
import { Socket } from "socket.io";
import File from "../models/File";
import User from "../models/User";
import redis from "../utils/redis";
import { getFileLock } from "../utils/lockManager";
import { syncProjectToSupabase } from "../utils/sync/syncToSupabase";

const getFilePresenceKey = (projectId: string, filePath: string) =>
  `file-users:${projectId}:${filePath}`;

type FilePayload = { filePath: string };
type WriteFilePayload = { filePath: string; data: string };
type DeletePayload = { filePath: string; projectId: string };

declare module "socket.io" {
  interface Socket {
    userId?: string;
  }
}

export const handleEditorSocketEvents = (socket: Socket, editorNamespace: any) => {
  const normalizedUserId = String(socket.userId);

  socket.on("joinProjectRoom", async ({ projectId }) => {
    socket.join(projectId);

    try {
      const user = await User.findById(normalizedUserId).select("username avatarUrl");
      if (!user) return;

      await redis.sadd(`project-users:${projectId}`, normalizedUserId);

      editorNamespace.to(projectId).emit("userJoinedProject", {
        userId: normalizedUserId,
        username: user.username,
        avatarUrl: user.avatarUrl,
        socketId: socket.id,
      });

      const userIds = await redis.smembers(`project-users:${projectId}`);
      const userMap = [];

      for (const id of userIds) {
        const u = await User.findById(id).select("username avatarUrl");
        const sock = Array.from(editorNamespace.sockets.values()).find(
          (s) => (s as Socket).userId === id
        ) as Socket | undefined;

        userMap.push({
          userId: id,
          username: u?.username || "Unknown",
          avatarUrl: u?.avatarUrl || "",
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
    await redis.srem(`project-users:${projectId}`, normalizedUserId);
    editorNamespace.to(projectId).emit("userLeftProject", {
      userId: normalizedUserId,
      socketId: socket.id,
    });
  });

socket.on("joinFileRoom", async ({ projectId, filePath }) => {
    socket.join(`${projectId}:${filePath}`);
    try {
      const lockHolder = await getFileLock(filePath);

      await redis.sadd(getFilePresenceKey(projectId, filePath), normalizedUserId);

      const user = await User.findById(normalizedUserId).select("username avatarUrl");

      editorNamespace.to(`${projectId}:${filePath}`).emit("userJoinedFile", {
        userId: normalizedUserId,
        username: user?.username || "Unknown",
        avatarUrl: user?.avatarUrl || "",
        socketId: socket.id,
        filePath,
      });

      const fileUserIds = await redis.smembers(getFilePresenceKey(projectId, filePath));
      const users = [];

      for (const id of fileUserIds) {
        const u = await User.findById(id).select("username avatarUrl");
        const sock = Array.from(editorNamespace.sockets.values()).find(
          (s) => (s as Socket).userId === id
        ) as Socket | undefined;

        users.push({
          userId: id,
          username: u?.username || "Unknown",
          avatarUrl: u?.avatarUrl || "",
          socketId: sock?.id || "",
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
          } catch (error) {
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
    } catch (error) {
      console.error("Error in joinFileRoom", error);
    }
  });

  socket.on("leaveFileRoom", async ({ projectId, filePath }) => {
    socket.leave(`${projectId}:${filePath}`);

    await redis.srem(getFilePresenceKey(projectId, filePath), normalizedUserId);

    editorNamespace.to(`${projectId}:${filePath}`).emit("userLeftFile", {
      userId: normalizedUserId,
      filePath,
    });

   const currentLockHolder = await getFileLock(filePath);
let actualUserId = currentLockHolder;

if (typeof currentLockHolder === "string" && currentLockHolder.startsWith("{")) {
  try {
    const parsed = JSON.parse(currentLockHolder);
    actualUserId = parsed.userId;
  } catch (e) {
    console.error("Failed to parse file lock holder", e);
  }
}

if (actualUserId === normalizedUserId) {
  await redis.del(`file-lock:${filePath}`);
  editorNamespace.to(`${projectId}:${filePath}`).emit("fileUnlocked", { filePath });
}
  });

  socket.on("writeFile", async ({ data, filePath, projectId }: WriteFilePayload & { projectId: string }) => {
    try {
      await fs.writeFile(filePath, data);

      editorNamespace.to(`${projectId}:${filePath}`).emit("writeFileSuccess", {
        data: "File written successfully",
        filePath,
      });
    } catch {
      socket.emit("error", { data: "Error writing the file" });
    }
  });

  socket.on("createFile", async ({ filePath, projectId }) => {
    try {
      await fs.writeFile(filePath, "");
      await File.create({
        name: path.basename(filePath),
        path: filePath,
        projectId,
        lastEditedBy: normalizedUserId,
      });

      socket.emit("createFileSuccess", { data: "File created successfully" });
      editorNamespace.to(projectId).emit("fileCreated", { path: filePath });
    } catch (error) {
      socket.emit("error", { data: "Error creating the file" });
    }
  });

  socket.on("readFile", async ({ filePath }: FilePayload) => {
    try {
      const content = await fs.readFile(filePath);
      socket.emit("readFileSuccess", {
        value: content.toString(),
        filePath,
        extension: path.extname(filePath),
      });
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
    } catch (error) {
      socket.emit("error", { data: "Error creating the folder", error: String(error) });
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

  socket.on("lockFile", async ({ projectId, filePath }) => {
  const key = `file-lock:${filePath}`;
  const userId = String(socket.userId); // ✅ SAFE user ID

const success = await redis.set(key, JSON.stringify({ userId }), "EX", 300, "NX");

  if (success) {
    editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", {
      filePath,
      userId,
    });
  } else {
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

    if (currentHolder.userId !== normalizedUserId) {
      return socket.emit("error", { message: "You don't hold the lock" });
    }

    await redis.set(lockKey, JSON.stringify({ userId: String(toUserId) }), "EX", 300);
    editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", {
      filePath,
      userId: String(toUserId),
    });
  });

  socket.on("requestLock", async ({ filePath, projectId }) => {
  const fileRoom = `${projectId}:${filePath}`;
  const user = await User.findById(normalizedUserId).select("username");

  editorNamespace.to(fileRoom).emit("fileLockRequested", {
    filePath,
    projectId,
    requestedBy: user?.username || "Unknown",
    requesterUserId: normalizedUserId,
  });
});

  socket.on("disconnect", async () => {
    const keys = await redis.keys("file-lock:*");
    for (const key of keys) {
      const value = await redis.get(key);
      if (!value) continue;
      const { userId } = JSON.parse(value);
      if (userId === normalizedUserId) {
        await redis.del(key);
        const [_, projectId, ...filePathParts] = key.split(":");
        const filePath = filePathParts.join(":");
        editorNamespace.to(`${projectId}:${filePath}`).emit("fileUnlocked", { filePath });
      }
    }

    const fileKeys = await redis.keys("file-users:*");
    for (const key of fileKeys) {
      const isPresent = await redis.sismember(key, normalizedUserId);
      if (isPresent) {
        await redis.srem(key, normalizedUserId);
        const [_, projectId, ...filePathParts] = key.split(":");
        const filePath = filePathParts.join(":");
        editorNamespace.to(`${projectId}:${filePath}`).emit("fileUserLeft", {
          userId: normalizedUserId,
        });
      }
    }
   if (socket.projectId) {
  await syncProjectToSupabase(socket.projectId, normalizedUserId);
}
  });
};
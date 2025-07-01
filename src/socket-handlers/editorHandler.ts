import fs from "fs/promises";
import path from "path";
import { Socket } from "socket.io";
import File from "../models/File";
import User from "../models/User";
import redis from "../utils/redis"; // Redis instance

// Redis-based file lock key format: file-lock:projectId:filePath
const getLockKey = (projectId: string, filePath: string) => `file-lock:${projectId}:${filePath}`;

// Types

type FilePayload = {
  filePath: string;
};

type WriteFilePayload = {
  filePath: string;
  data: string;
};

type DeletePayload = {
  pathToFileOrFolder: string;
  projectId: string;
};

export const handleEditorSocketEvents = (socket: Socket, editorNamespace: any) => {
  // 🧑‍🤝‍🧑 Project room join
  socket.on("joinProjectRoom", async ({ projectId }) => {
    socket.join(projectId);

    try {
      const user = await User.findById(socket.userId).select("username");
      if (!socket.userId) {
        console.error("Missing userId on socket");
        return;
      }

      await redis.sadd(`online-users:${projectId}`, socket.userId);

      editorNamespace.to(projectId).emit("userJoined", {
        userId: socket.userId,
        username: user?.username || "Unknown",
        socketId: socket.id,
      });

      const userIds = await redis.smembers(`online-users:${projectId}`);
      const userMap = await Promise.all(
        userIds.map(async (id) => {
          const u = await User.findById(id).select("username");
          return {
            userId: id,
            username: u?.username || "Unknown",
          };
        })
      );
      socket.emit("initialUsers", userMap);

      console.log(`👥 User ${user?.username} (${socket.userId}) joined project ${projectId}`);
    } catch (err) {
      console.error("Error in joinProjectRoom", err);
    }
  });

  // 🚪 Project room leave
  socket.on("leaveProjectRoom", async ({ projectId }) => {
    socket.leave(projectId);

    if (!socket.userId) {
      console.error("Missing userId on socket");
      return;
    }

    await redis.srem(`online-users:${projectId}`, socket.userId);

    editorNamespace.to(projectId).emit("userLeft", {
      userId: socket.userId,
      socketId: socket.id,
    });
    console.log(`👥 User ${socket.userId} left project room ${projectId}`);
  });

  // 💡 File room join/leave
  socket.on("joinFileRoom", ({ projectId, pathToFileOrFolder }) => {
    socket.join(`${projectId}:${pathToFileOrFolder}`);
  });

  socket.on("leaveFileRoom", ({ projectId, pathToFileOrFolder }) => {
    socket.leave(`${projectId}:${pathToFileOrFolder}`);
  });

  // 🔒 Lock file
 socket.on("lockFile", async ({ projectId, filePath, requestId }) => {
  try {
    const key = getLockKey(projectId, filePath);
    const lockExists = await redis.get(key);
    const user = await User.findById(socket.userId).select("username");

    if (lockExists) {
      const existingLock = JSON.parse(lockExists);
      
      // Check if already locked by same user
      if (existingLock.userId === socket.userId) {
        socket.emit("fileLockGranted", {
          userId: socket.userId,
          username: user?.username || "Unknown",
          filePath,
          requestId
        });
      } else {
        socket.emit("fileLockDenied", {
          userId: existingLock.userId,
          username: existingLock.username,
          filePath,
          requestId
        });
      }
    } else {
      // Grant lock
      const locker = {
        userId: socket.userId,
        username: user?.username || "Unknown",
      };
      
      await redis.set(key, JSON.stringify(locker), "EX", 300); // 5 min expiry
      
      // Emit to all users in file room
      editorNamespace.to(`${projectId}:${filePath}`).emit("fileLocked", {
        ...locker,
        filePath,
      });
      
      // Confirm to requester
      socket.emit("fileLockGranted", {
        ...locker,
        filePath,
        requestId
      });
    }
  } catch (error) {
    console.error("Lock error:", error);
    socket.emit("lockError", {
      error: "Failed to acquire lock",
      requestId,
      filePath
    });
  }
});

  // 🔓 Unlock file
 socket.on("unlockFile", async ({ projectId, filePath }) => {
  try {
    const key = getLockKey(projectId, filePath);
    const lockData = await redis.get(key);
    
    if (lockData) {
      const lock = JSON.parse(lockData);
      // Only allow unlocking by the lock owner
      if (lock.userId === socket.userId) {
        await redis.del(key);
        editorNamespace.to(`${projectId}:${filePath}`).emit("fileUnlocked", { filePath });
        socket.emit("fileLockReleased", { filePath });
      }
    }
  } catch (error) {
    socket.emit("lockError", { 
      error: "Failed to release lock", 
      filePath 
    });
  }
});

  // 📝 Write file
  socket.on("writeFile", async ({ data, filePath, projectId }: WriteFilePayload & { projectId: string }) => {
    try {
      await fs.writeFile(filePath, data);
      editorNamespace.to(`${projectId}:${filePath}`).emit("writeFileSuccess", {
        data: "File written successfully",
        filePath: filePath,
      });
    } catch {
      socket.emit("error", { data: "Error writing the file" });
    }
  });

  // 📄 Create file
  socket.on("createFile", async ({ pathToFileOrFolder, projectId }) => {
    try {
      await fs.writeFile(pathToFileOrFolder, "");
      await File.create({
        name: path.basename(pathToFileOrFolder),
        path: pathToFileOrFolder,
        projectId,
        lastEditedBy: socket.userId,
      });

      socket.emit("createFileSuccess", { data: "File created successfully" });
      editorNamespace.to(projectId).emit("fileCreated", { path: pathToFileOrFolder });
    } catch (error) {
      console.error("❌ Error creating the file", error);
      socket.emit("error", { data: "Error creating the file" });
    }
  });

  // 📖 Read file
  socket.on("readFile", async ({filePath }: FilePayload) => {
   try {
    console.log("📖 Attempting to read file:", filePath);
    const content = await fs.readFile(filePath);
    socket.emit("readFileSuccess", {
      value: content.toString(),
      filePath: filePath,
      extension: path.extname(filePath),
    });
  } catch (err) {
    console.error("❌ Failed to read file:", filePath, err);
    socket.emit("error", { data: "Error reading the file" });
  }
  });

  // 🗑️ Delete file
  socket.on("deleteFile", async ({ pathToFileOrFolder, projectId }: DeletePayload) => {
    try {
      await fs.unlink(pathToFileOrFolder);
      editorNamespace.to(projectId).emit("fileDeleted", { path: pathToFileOrFolder });
      socket.emit("deleteFileSuccess", { data: "File deleted" });
    } catch {
      socket.emit("error", { data: "Failed to delete file" });
    }
  });

  // 📁 Create folder
  socket.on("createFolder", async ({ pathToFileOrFolder, projectId }) => {
    try {
      await fs.mkdir(pathToFileOrFolder, { recursive: true });
      socket.emit("createFolderSuccess", { data: "Folder created successfully" });
      editorNamespace.to(projectId).emit("folderCreated", { path: pathToFileOrFolder });
    } catch (error) {
      console.error("❌ Error creating the folder", error);
      socket.emit("error", { data: "Error creating the folder" });
    }
  });

  // 🗑️ Delete folder
  socket.on("deleteFolder", async ({ pathToFileOrFolder, projectId }: DeletePayload) => {
    try {
      await fs.rm(pathToFileOrFolder, { recursive: true, force: true });
      editorNamespace.to(projectId).emit("folderDeleted", { path: pathToFileOrFolder });
      socket.emit("deleteFolderSuccess", { data: "Folder deleted successfully" });
    } catch {
      socket.emit("error", { data: "Error deleting the folder" });
    }
  });

  // On disconnect: unlock any files the user locked
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
  });
};
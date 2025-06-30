import fs from "fs/promises";
import path from "path";
import { Socket } from "socket.io";
import File from "../models/File";
import User from "../models/User";
import redis from "../utils/redis"; // Redis instance

type FilePayload = {
  pathToFileOrFolder: string;
};

type WriteFilePayload = {
  pathToFileOrFolder: string;
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

      // ➕ Add user to Redis set
      if (!socket.userId) {
  console.error("Missing userId on socket");
  return;
}

      await redis.sadd(`online-users:${projectId}`, socket.userId);

      // 🔁 Broadcast join
      editorNamespace.to(projectId).emit("userJoined", {
        userId: socket.userId,
        username: user?.username || "Unknown",
        socketId: socket.id,
      });

      // 📦 Send initial users to newly joined socket
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

    // ➖ Remove user from Redis
    if (!socket.userId) {
  console.error("Missing userId on socket");
  return;
}

await redis.sadd(`online-users:${projectId}`, socket.userId);

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

  // 📝 Write file
  socket.on("writeFile", async ({ data, pathToFileOrFolder, projectId }: WriteFilePayload & { projectId: string }) => {
    try {
      await fs.writeFile(pathToFileOrFolder, data);
      editorNamespace.to(`${projectId}:${pathToFileOrFolder}`).emit("writeFileSuccess", {
        data: "File written successfully",
        path: pathToFileOrFolder,
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
  socket.on("readFile", async ({ pathToFileOrFolder }: FilePayload) => {
    try {
      const content = await fs.readFile(pathToFileOrFolder);
      socket.emit("readFileSuccess", {
        value: content.toString(),
        path: pathToFileOrFolder,
        extension: path.extname(pathToFileOrFolder),
      });
    } catch {
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
};
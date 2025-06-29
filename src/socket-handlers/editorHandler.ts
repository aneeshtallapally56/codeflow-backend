import fs from "fs/promises";
import path from "path";
import { Socket } from "socket.io";
import File from "../models/File";
import User from "../models/User";

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
  // 💡 File room join/leave (for per-file sync)
  socket.on("joinFileRoom", ({ projectId, pathToFileOrFolder }) => {
    const roomId = `${projectId}:${pathToFileOrFolder}`;
    socket.join(roomId);
  });

  socket.on("leaveFileRoom", ({ projectId, pathToFileOrFolder }) => {
    const roomId = `${projectId}:${pathToFileOrFolder}`;
    socket.leave(roomId);
  });

  // 🧑‍🤝‍🧑 Project room join
  socket.on("joinProjectRoom", async ({ projectId }) => {
    socket.join(projectId);

    try {
      const user = await User.findById(socket.userId).select("username");

      // 👥 Inform others that a user joined
      editorNamespace.to(projectId).emit("userJoined", {
        userId: socket.userId,
        username: user?.username || "Unknown",
        socketId: socket.id,
      });

      // 📦 Send initial users to the joining user
      const clientsInRoom = Array.from(editorNamespace.adapter.rooms.get(projectId) || []);
      const userMap = await Promise.all(
        clientsInRoom.map(async (socketId) => {
          const s = editorNamespace.sockets.get(socketId);
          const u = await User.findById((s as any).userId).select("username");
          return {
            userId: (s as any).userId,
            username: u?.username || "Unknown",
            socketId,
          };
        })
      );
      socket.emit("initialUsers", userMap);

      console.log(`👥 User ${user?.username} (${socket.userId}) joined project room ${projectId}`);
    } catch (error) {
      console.error("Error in joinProjectRoom:", error);
    }
  });

  // 🚪 Project room leave
  socket.on("leaveProjectRoom", ({ projectId }) => {
    socket.leave(projectId);
    editorNamespace.to(projectId).emit("userLeft", {
      userId: socket.userId,
      socketId: socket.id,
    });
    console.log(`👥 User ${socket.userId} left project room ${projectId}`);
  });

  // 📝 Write file
  socket.on("writeFile", async ({ data, pathToFileOrFolder, projectId }: WriteFilePayload & { projectId: string }) => {
    try {
      await fs.writeFile(pathToFileOrFolder, data);
      const roomId = `${projectId}:${pathToFileOrFolder}`;
      editorNamespace.to(roomId).emit("writeFileSuccess", {
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
      socket.emit("createFileSuccess", { data: "File created successfully" });

      await File.create({
        name: path.basename(pathToFileOrFolder),
        path: pathToFileOrFolder,
        projectId,
        lastEditedBy: socket.userId,
      });

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
      const fileExtension = path.extname(pathToFileOrFolder);
      socket.emit("readFileSuccess", {
        value: content.toString(),
        path: pathToFileOrFolder,
        extension: fileExtension,
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
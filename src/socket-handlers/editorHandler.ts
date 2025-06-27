import fs from "fs/promises";
import path from "path";
import { Socket } from "socket.io";
import File from '../models/File'

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
  socket.on("joinFileRoom", ({ projectId, pathToFileOrFolder }) => {
    const roomId = `${projectId}:${pathToFileOrFolder}`;
    socket.join(roomId);
  });

  socket.on("leaveFileRoom", ({ projectId, pathToFileOrFolder }) => {
    const roomId = `${projectId}:${pathToFileOrFolder}`;
    socket.leave(roomId);
  });

  socket.on("joinProjectRoom", ({ projectId }) => {
    socket.join(projectId);
  });

  socket.on("leaveProjectRoom", ({ projectId }) => {
    socket.leave(projectId);
  });

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

 socket.on("createFile", async ({ pathToFileOrFolder, projectId }) => {
  try {
    await fs.writeFile(pathToFileOrFolder, "");
    socket.emit("createFileSuccess", { data: "File created successfully" });
    //push to db
      await File.create({
      name,
      path: pathToFileOrFolder,
      project: projectId,
      lastEditedBy: socket.userId, 
    });

    // 🔁 Broadcast to other tabs
    editorNamespace.to(projectId).emit("fileCreated", { path: pathToFileOrFolder });

  } catch (error) {
    console.error("❌ Error creating the file", error);
    socket.emit("error", { data: "Error creating the file" });
  }
});

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

  socket.on("deleteFile", async ({ pathToFileOrFolder, projectId }: DeletePayload) => {
    try {
      await fs.unlink(pathToFileOrFolder);
      editorNamespace.to(projectId).emit("fileDeleted", { path: pathToFileOrFolder });
      socket.emit("deleteFileSuccess", { data: "File deleted" });
    } catch {
      socket.emit("error", { data: "Failed to delete file" });
    }
  });

 socket.on("createFolder", async ({ pathToFileOrFolder, projectId }) => {
  try {
    await fs.mkdir(pathToFileOrFolder, { recursive: true });
    socket.emit("createFolderSuccess", { data: "Folder created successfully" });

    // 🔁 Broadcast to other tabs
    editorNamespace.to(projectId).emit("folderCreated", { path: pathToFileOrFolder });

  } catch (error) {
    console.error("❌ Error creating the folder", error);
    socket.emit("error", { data: "Error creating the folder" });
  }
});

  // ✅ Broadcast folderDeleted
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
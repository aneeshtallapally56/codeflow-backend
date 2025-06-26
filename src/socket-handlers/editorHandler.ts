// import { getContainerPort } from "../containers/handleContainerCreate.js";
import fs from "fs/promises";
import path from "path"; // Add this import for path utilities
import { Socket } from "socket.io";

type FilePayload = {
  pathToFileOrFolder: string;
};

type WriteFilePayload = {
  pathToFileOrFolder: string;
  data: string;
};

export const handleEditorSocketEvents = (socket: Socket, editorNamespace: any) => {
   socket.on("joinFileRoom", ({ projectId, pathToFileOrFolder }) => {
    const roomId = `${projectId}:${pathToFileOrFolder}`;
    socket.join(roomId);
    console.log(`User joined room ${roomId}`);
  });

  socket.on("leaveFileRoom", ({ projectId, pathToFileOrFolder }) => {
    const roomId = `${projectId}:${pathToFileOrFolder}`;
    socket.leave(roomId);
    console.log(`User left room ${roomId}`);
  });

  socket.on("writeFile", async ({ data, pathToFileOrFolder, projectId }: WriteFilePayload & { projectId: string }) => {
    try {
      await fs.writeFile(pathToFileOrFolder, data);

      const roomId = `${projectId}:${pathToFileOrFolder}`;
      editorNamespace.to(roomId).emit("writeFileSuccess", {
        data: "File written successfully",
        path: pathToFileOrFolder,
      });

    } catch (error) {
      console.error("Error writing the file", error);
      socket.emit("error", {
        data: "Error writing the file",
      });
    }
  });
  
  socket.on("createFile", async ({ pathToFileOrFolder }: FilePayload) => {
     const isFileAlreadyPresent = await fs.stat(pathToFileOrFolder);
        if(isFileAlreadyPresent) {
            editorNamespace.emit("error", {
                data: "File already exists",
            });
            return;
        }

        try {
            const response = await fs.writeFile(pathToFileOrFolder, "");
            socket.emit("createFileSuccess", {
                data: "File created successfully",
            });
        } catch(error) {
            console.log("Error creating the file", error);
            socket.emit("error", {
                data: "Error creating the file",
            });
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
    } catch (error) {
      console.error("Error reading the file", error);
      socket.emit("error", { data: "Error reading the file" });
    }
  });

  socket.on("deleteFile", async ({ pathToFileOrFolder }: FilePayload) => {
    try {
      await fs.unlink(pathToFileOrFolder);
      socket.emit("deleteFileSuccess", {
        data: "File deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting the file", error);
      socket.emit("error", { data: "Error deleting the file" });
    }
  });

  socket.on("createFolder", async ({ pathToFileOrFolder }: FilePayload) => {
    try {
      await fs.mkdir(pathToFileOrFolder, { recursive: true });
      socket.emit("createFolderSuccess", {
        data: "Folder created successfully",
      });
    } catch (error) {
      console.error("Error creating the folder", error);
      socket.emit("error", { data: "Error creating the folder" });
    }
  });

  socket.on("deleteFolder", async ({ pathToFileOrFolder }: FilePayload) => {
    try {
      await fs.rm(pathToFileOrFolder, { recursive: true, force: true });
      socket.emit("deleteFolderSuccess", {
        data: "Folder deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting the folder", error);
      socket.emit("error", { data: "Error deleting the folder" });
    }
  });

  // Optional future enhancement
  // socket.on("getPort", async ({ containerName }: { containerName: string }) => {
  //   const port = await getContainerPort(containerName);
  //   socket.emit("getPortSuccess", { port });
  // });
};
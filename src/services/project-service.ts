import uuid4 from "uuid4";
import path from "path";
import fs from "fs/promises";
import os from "os";
import directoryTree from "directory-tree";
import { execPromise } from "../utils/exec-utility";
import { getProjectPath } from "../utils/projectPath/projectPath";

type Framework = "React" | "NextJs" | "Angular" | "Vue";

export const createProjectService = async (type: string) => {
  const framework = type;
  const projectId = uuid4();
  const projectPath = getProjectPath(projectId);
  
  // Ensure tmp directory exists
  await fs.mkdir(projectPath, { recursive: true });

  let command = "";

  switch (framework) {
    case "React":
      command = process.env.REACT_PROJECT_COMMAND!;
      break;
    case "Vue":
      command = process.env.VUE_PROJECT_COMMAND!;
      break;
    case "NextJs":
      command = process.env.NEXT_PROJECT_COMMAND!;
      break;
    case "Angular":
      command = process.env.ANGULAR_PROJECT_COMMAND!;
      break;
    default:
      throw new Error(`Unsupported framework type: ${framework}`);
  }




  try {
    await execPromise(command, { cwd: projectPath });
    
    // Verify project was created successfully
    const projectContents = await fs.readdir(projectPath);

    
    if (projectContents.length === 0) {
      throw new Error("Project creation resulted in empty directory");
    }
    
  } catch (err: any) {
    console.error("❌ Error running command:");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    console.error("Command Output:", err.stdout || err.stderr || err.output);
    
    // Clean up on failure
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error("Failed to clean up project directory:", cleanupErr);
    }
    
    throw err;
  }

  return projectId;
};

export const getProjectTree = async (projectId: string) => {
  const projectPath = getProjectPath(projectId);
  
  try {
    // Check if project directory exists
    await fs.access(projectPath);
    
    const projectTree = directoryTree(projectPath, {
      exclude: /node_modules|\.git|\.next|dist|build/
    });
    
    if (!projectTree) {
      throw new Error("Project directory is empty or inaccessible");
    }
    
    return projectTree;
  } catch (err) {
    console.error("Error accessing project directory:", err);
    throw new Error(`Project directory not found: ${projectPath}`);
  }
};

export const deleteProjectService = async (projectId: string) => {
  const projectPath = getProjectPath(projectId);

  try {

    await fs.access(projectPath);
    await fs.rm(projectPath, { recursive: true, force: true });

  } catch (err) {
    console.warn("⚠️ Project folder not found or already deleted:", projectPath);
  }
};
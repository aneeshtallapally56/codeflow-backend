import { NextFunction, Request, Response } from "express";
import { createProjectService } from "../services/project-service";
import { getProjectTree as getTree } from "../services/project-service";
import { deleteProjectService } from "../services/project-service";
import Project from "../models/Project";
import mongoose from "mongoose";
import '../types/express'; 

import path from "path";
import fs from "fs";
import { zipDirectory } from "../utils/upload/zipDirectory";
import { uploadToSupabase } from "../utils/upload/uploadToSupabase";
import { downloadAndExtractZip } from "../utils/download/downloadAndExtractZip";
import { supabase } from "../config/supabase";
import { getProjectPath } from "../utils/projectPath/projectPath"; // Add this import

export async function createProject(
  req: Request,
  res: Response,
  next?: NextFunction
): Promise<void> {
  try {
    const { title, type } = req.body;
    const user = req.user as { _id: mongoose.Types.ObjectId };
    const userId = user._id.toString();

    if (!userId || !title) {
      res.status(400).json({ message: "Missing title or userId" });
      return;
    }

    // Create project in system temp directory
    const projectId = await createProjectService(type);
    const projectPath = getProjectPath(projectId); // Use getProjectPath instead of hardcoded path
    const zipPath = path.join(path.dirname(projectPath), `${projectId}.zip`); // Create zip in same temp directory

    // Verify project was created
    if (!fs.existsSync(projectPath)) {
      throw new Error("Project directory was not created");
    }

    // Zip the project directory
    await zipDirectory(projectPath, zipPath);

    // Upload to Supabase
    const downloadUrl = await uploadToSupabase(zipPath, userId, projectId);

    // Create database entry
    const newProject = await Project.create({
      _id: projectId,
      title,
      type,
      user: userId,
      downloadUrl, 
      members: [userId]
    });

    // Clean up zip file but keep the project directory
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    res.status(200).json({
      message: "Project created successfully",
      projectId,
      downloadUrl
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error creating project folder:", err.message);
    res.status(500).json({
      error: err.message || "Failed to create project directory",
    });
  }
}

export async function getProjectTree(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project || !project.downloadUrl) {
      res.status(404).json({ message: "Project not found or missing download URL" });
      return;
    }

    const projectPath = getProjectPath(projectId); // Use getProjectPath instead of hardcoded path
    
    // Check if project exists in tmp and has content
    const projectExists = fs.existsSync(projectPath);
    let hasContent = false;
    
    if (projectExists) {
      try {
        const files = fs.readdirSync(projectPath);
        hasContent = files.length > 0;
      } catch (err) {
        console.warn("Error reading project directory:", err);
        hasContent = false;
      }
    }

    // Extract from Supabase if project doesn't exist or is empty
    if (!projectExists || !hasContent) {

      await downloadAndExtractZip(projectId, project.downloadUrl);
    } else {

    }

    const tree = await getTree(projectId);
    res.status(200).json({
      message: "Project tree retrieved successfully",
      tree,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error retrieving tree:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export const getUserProjects = async (req: Request, res: Response) => {
  try {
    const user = req.user as { _id: mongoose.Types.ObjectId };
    const userId = user._id.toString();

    if (!user?._id) {
       res.status(401).json({ message: "Unauthorized" });
       return;
    }

    const projects = await Project.find({
      $or: [
        { user: user._id },                
        { members: user._id }               
      ]
    })
    .sort({ createdAt: -1 })
    .populate("user", "username avatarUrl")
    .populate("members", "username avatarUrl");

    res.status(200).json({ projects });
  } catch (err) {
    console.error("❌ Error fetching projects:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const user = req.user as { _id: mongoose.Types.ObjectId };
    const userId = user._id.toString();

    if (!userId || !projectId) {
      res.status(400).json({ message: "Missing projectId or userId" });
       return;
    }
    
    // Check if project exists and belongs to user
    const project = await Project.findById(projectId);
    if (!project || project.user.toString() !== userId) {
      res.status(404).json({ message: "Project not found or unauthorized" });
      return;
    }

    //Delete from Supabase

      const { error: supabaseError } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET_NAME!)
      .remove([`${userId}/${projectId}.zip`]);

    if (supabaseError) {
      console.error("❌ Supabase deletion failed:", supabaseError.message);
      res.status(500).json({ message: "Failed to delete project zip from cloud" });
       return;
    }
    // Delete from DB
    await project.deleteOne();

    // Delete from file system
    await deleteProjectService(projectId);

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const user = req.user as { _id: mongoose.Types.ObjectId };
  const userId = user._id.toString();
  
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
 
    res.status(200).json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export const joinProject = async (req: Request, res: Response) => {
  try {
    const user = req.user as { _id: mongoose.Types.ObjectId };
    const userId = user._id.toString();
    const { projectId } = req.body;

    const project = await Project.findById(projectId);

    if (!project) {
       res.status(404).json({ message: "Project not found" });
       return;
    }

    const alreadyCollaborator = project.members
      .map((id: mongoose.Types.ObjectId) => id.toString())
      .includes(userId);

    if (alreadyCollaborator) {
      res.status(400).json({ message: "You're already a collaborator" });
      return;
    }

    project.members.push(userId);
    await project.save();

    res.status(200).json({ message: "Joined project successfully" });
    return;
  } catch (err) {
    console.error("Error joining project:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const leaveProject = async (req: Request, res: Response) => {
  try {
    const user = req.user as { _id: mongoose.Types.ObjectId };
    const userId = user._id.toString();
    const { projectId } = req.body;

    const project = await Project.findById(projectId);

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (project.user.toString() === userId) {
      res.status(400).json({ message: "You cannot leave your own project" });
      return;
    }

    project.members = project.members.filter(
      (id: mongoose.Types.ObjectId) => id.toString() !== userId
    );
    await project.save();

    res.status(200).json({ message: "Left project successfully" });
  } catch (err) {
    console.error("Error leaving project:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
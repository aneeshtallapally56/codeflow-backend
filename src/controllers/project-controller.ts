import { NextFunction, Request, Response } from "express";
import { createProjectService } from "../services/project-service";
import { getProjectTree as getTree } from "../services/project-service";
import Project from "../models/Project";
import mongoose from "mongoose";
import '../types/express'; 


export async function createProject(
  req: Request,
  res: Response,
  next?: NextFunction
): Promise<void> {
  try {
    const { title } = req.body;
    const user = req.user as { _id: mongoose.Types.ObjectId };
    const userId = user._id.toString();

    if (!userId || !title) {
      res.status(400).json({ message: "Missing title or userId" });
      return;
    }

    const projectId = await createProjectService();
    const newProject = await Project.create({
      _id: projectId,
      title,
      user: userId,
    });

    res.status(200).json({
      message: "Project created successfully",
      projectId,
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
    const tree = await getTree(req.params.projectId);
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

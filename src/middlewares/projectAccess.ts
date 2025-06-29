import Project from "../models/Project";
import { Request, Response, NextFunction } from "express";
import mongoose ,{Types}from "mongoose";

export const checkProjectAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { _id: mongoose.Types.ObjectId };
    const userId = user._id.toString(); // ✅ consistent userId extraction

    const projectId = req.params.projectId;

    const project = await Project.findById(projectId);

    if (!project) {
      res.status(404).json({ success: false, message: "Project not found" });
      return ;
    }

    const isOwner = project.user.toString() === userId;
    const isCollaborator = project.members
      .map((id:Types.ObjectId) => id.toString())
      .includes(userId);

    if (!isOwner && !isCollaborator) {
       res.status(403).json({ success: false, message: "Access denied" });
       return;
    }

    next();
  } catch (err) {
    console.error("checkProjectAccess error:", err);
    res.status(500).json({ success: false, message: "Server error" });
    return ;
  }
};
import { Request, Response } from "express";
import File from "../models/File";
import mongoose from "mongoose";

export const createFile = async (req: Request, res: Response) => {
  try {
    const { name, path, content, project } = req.body;
      const user = req.user as { _id: mongoose.Types.ObjectId };
        const userId = user._id.toString();

    if (!name || !path || !project) {
       res.status(400).json({ message: "Missing required fields" });
       return;
    }

    const newFile = await File.create({
      name,
      path,
      content: content || "",
      project,
      lastEditedBy: user._id,
    });

    res.status(201).json({ message: "File created", file: newFile });
  } catch (err) {
    console.error("Error creating file:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getFilesByProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const files = await File.find({ project: projectId }).sort({ path: 1 });

    res.status(200).json({ files });
  } catch (err) {
    console.error("Error fetching files:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateFileContent = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const { content } = req.body;
      const user = req.user as { _id: mongoose.Types.ObjectId };
        const userId = user._id.toString();

    const file = await File.findByIdAndUpdate(
      fileId,
      { content, lastEditedBy: user._id },
      { new: true }
    );

    if (!file) {
      res.status(404).json({ message: "File not found" });
       return;
    }

    res.status(200).json({ message: "File updated", file });
  } catch (err) {
    console.error("Error updating file:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
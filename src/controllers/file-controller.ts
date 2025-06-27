import { Request, Response } from "express";
import File from "../models/File";
import mongoose from "mongoose";

export const createFile = async (req: Request, res: Response) => {
  try {
    const { name, path, projectId } = req.body;
      const user = req.user as { _id: mongoose.Types.ObjectId };
        const userId = user._id.toString();

    if (!name || !path || !projectId) {
       res.status(400).json({ message: "Missing required fields" });
       return;
    }

    const newFile = await File.create({
      name,
      path,
      projectId,
      lastEditedBy: userId,
    });
const populatedFile = await File.findById(newFile._id).populate("lastEditedBy", "username");

    res.status(201).json({ message: "File created", file: populatedFile });
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
      const updatedFile = await File.findById(fileId).populate("lastEditedBy", "username");

    res.status(200).json({ message: "File updated", updatedFile });
  } catch (err) {
    console.error("Error updating file:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
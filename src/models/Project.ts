import mongoose, { Schema, Document, Types } from "mongoose";
import { IProject } from "../types/project";

const ProjectSchema: Schema = new Schema<IProject>(
  {
    _id: { type: String, required: true }, // Use uuid string
    title: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    
    // Add enum field here
    type: {
      type: String,
      enum: ["React", "NextJs", "Angular", "Vue"],
      required: true,
    },
    downloadUrl: { type: String }, // URL to the zip file
  },
  {
    timestamps: true,
    _id: false,
  }
);

export default mongoose.models.Project ||
  mongoose.model<IProject>("Project", ProjectSchema);
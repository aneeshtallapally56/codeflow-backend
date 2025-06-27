import mongoose, { Schema, Document , Types } from "mongoose";
import { IProject } from "../types/project";



const ProjectSchema: Schema = new Schema<IProject>(
  {
    _id: { type: String, required: true }, // Use uuid string
    title: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    collaborators: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
    _id: false, // allows setting _id manually
  }
);

export default mongoose.models.Project ||
  mongoose.model<IProject>("Project", ProjectSchema);
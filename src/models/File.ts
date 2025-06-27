import mongoose, { Schema, Document } from "mongoose";

export interface IFile extends Document {
  name: string;
  path: string;
  projectId: string; // UUID string
  size?: number;
  type?: string;
  lastEditedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const FileSchema = new Schema<IFile>(
  {
    name: { type: String, required: true },
    path: { type: String, required: true },
    projectId: { type: String, ref: "Project", required: true },
    size: { type: Number },
    type: { type: String },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.models.File || mongoose.model<IFile>("File", FileSchema);
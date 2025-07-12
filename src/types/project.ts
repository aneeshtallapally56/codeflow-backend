import { Types } from "mongoose";

export interface IProject {
    _id: string; // UUID

  title: string;
  user: Types.ObjectId;
  members?: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
  downloadUrl?: string; 
  type: "React" | "Nextjs" | "Angular" | "Vue"; 
}
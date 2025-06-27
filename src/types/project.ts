import { Types } from "mongoose";

export interface IProject {
    _id: string; // UUID

  title: string;
  user: Types.ObjectId;
  collaborators?: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}
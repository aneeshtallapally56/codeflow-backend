// utils/syncProject.ts

import fs from "fs/promises";
import path from "path";
import { zipDirectory } from "../upload/zipDirectory";
import { uploadToSupabase } from "../upload/uploadToSupabase";
import { getProjectPath } from "../projectPath/projectPath";

export async function syncProjectToSupabase(projectId: string, userId: string) {
  const zipPath = `/tmp/${projectId}.zip`;
   const projectPath = path.join(getProjectPath(projectId), "sandbox");

  try {
    await zipDirectory(projectPath, zipPath);
    await uploadToSupabase(zipPath, userId, projectId);
    await fs.unlink(zipPath); // clean up

  } catch (err) {
    console.error("❌ Failed to sync project to Supabase:", err);
  }
}
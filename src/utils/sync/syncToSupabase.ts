// utils/syncProject.ts

import fs from "fs/promises";
import path from "path";
import { zipDirectory } from "../upload/zipDirectory";
import { uploadToSupabase } from "../upload/uploadToSupabase";

export async function syncProjectToSupabase(projectId: string, userId: string) {
  const zipPath = `/tmp/${projectId}.zip`;
  const projectPath = `/tmp/${projectId}`;

  try {
    await zipDirectory(projectPath, zipPath);
    await uploadToSupabase(zipPath, userId, projectId);
    await fs.unlink(zipPath); // clean up
    console.log(`✅ Synced project ${projectId} to Supabase`);
  } catch (err) {
    console.error("❌ Failed to sync project to Supabase:", err);
  }
}
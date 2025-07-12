// utils/cron/cleanupTmpProjects.ts
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';

const TMP_DIR = '/tmp';
const MAX_AGE_MS = 6 * 60 * 60 * 1000; 

export function startTmpCleanupJob() {
  // Runs every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log("🧹 Cron: Cleaning /tmp directory...");

    try {
      const entries = await fs.readdir(TMP_DIR);
      const now = Date.now();

      for (const entry of entries) {
        const fullPath = path.join(TMP_DIR, entry);

        try {
          const stats = await fs.stat(fullPath);
          if (now - stats.mtimeMs > MAX_AGE_MS) {
            await fs.rm(fullPath, { recursive: true, force: true });
            console.log(`🗑️ Deleted stale tmp folder: ${entry}`);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to stat or delete ${entry}:`, err);
        }
      }
    } catch (err) {
      console.error("❌ Cron error cleaning tmp directory:", err);
    }
  });
}
// utils/downloadAndExtractZip.ts
import fs from 'fs';
import unzipper from 'unzipper';

export async function downloadAndExtractZip(projectId: string, downloadUrl: string): Promise<void> {
  const tmpDir = `/tmp/${projectId}`;
  const zipPath = `/tmp/${projectId}.zip`;

  // Remove existing directory if it exists but is empty or corrupted
  if (fs.existsSync(tmpDir)) {
    try {
      const files = fs.readdirSync(tmpDir);
      if (files.length === 0) {
        fs.rmSync(tmpDir, { recursive: true, force: true });

      } else {
        console.log("⚠️ Project directory exists with content, skipping extraction.");
        return;
      }
    } catch (err) {
      // If we can't read the directory, it's probably corrupted, so remove it
      fs.rmSync(tmpDir, { recursive: true, force: true });

    }
  }



  const response = await fetch(downloadUrl);


  if (!response.ok) {
    const text = await response.text();
    console.error("❌ Failed to download zip:", text);
    throw new Error(`Download failed with status ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());


  // Ensure tmp directory exists
  if (!fs.existsSync('/tmp')) {
    fs.mkdirSync('/tmp', { recursive: true });
  }

  fs.writeFileSync(zipPath, buffer);
 

  try {
    // Create the extraction directory
    fs.mkdirSync(tmpDir, { recursive: true });
    
    await fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: tmpDir }))
      .promise();
    

    
    // Verify extraction was successful
    const extractedFiles = fs.readdirSync(tmpDir);

    
    if (extractedFiles.length === 0) {
      throw new Error("Extraction resulted in empty directory");
    }
    
  } catch (err) {
    console.error("❌ Failed to extract zip:", err);
    // Clean up on failure
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    throw err;
  } finally {
    // Clean up zip file
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);

    }
  }
}
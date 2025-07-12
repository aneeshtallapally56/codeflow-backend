import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

export function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    archive.glob('**/*', {
      cwd: sourceDir,
      ignore: ['node_modules/**', '.next/**', '.git/**'],
    });

    archive.finalize();
  });
}
import os from "os";
import path from "path";

export function getProjectPath(projectId: string) {
  return path.join(os.tmpdir(), projectId);
}
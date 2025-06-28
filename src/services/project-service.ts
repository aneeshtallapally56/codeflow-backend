import uuid4 from "uuid4";
import path from "path";
import fs from "fs/promises";
import directoryTree from "directory-tree";
import { execPromise } from "../utils/exec-utility";

export const createProjectService = async () => {
  

  const command = process.env.REACT_PROJECT_COMMAND!;
  const projectId = uuid4();
  console.log("New project ID:", projectId);

  const projectPath = path.join(process.cwd(), "generated-projects", projectId);
  await fs.mkdir(projectPath, { recursive: true });

  const response = await execPromise(command, {
    cwd: projectPath,
  });
  return projectId;
};

export const getProjectTree = async (projectId: string) => {
  const projectPath = path.resolve(process.cwd(), "generated-projects", projectId);
  const projectTree = directoryTree(projectPath);
    return projectTree;

}
export const deleteProjectService  = async (projectId: string) => {
  const projectPath = path.join(process.cwd(), "generated-projects", projectId);

   if (!(await fs.stat(projectPath).catch(() => false))) {
  console.warn("Project folder not found:", projectPath);
  return;
   }
   await fs.rm(projectPath, { recursive: true, force: true });
}